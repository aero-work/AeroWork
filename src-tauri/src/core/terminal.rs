use parking_lot::RwLock;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub terminal_id: String,
    pub data: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TerminalInfo {
    pub id: String,
    pub working_dir: String,
}

// Channel-based handle to communicate with the terminal thread
struct TerminalHandle {
    input_tx: mpsc::UnboundedSender<TerminalInput>,
    info: TerminalInfo,
}

enum TerminalInput {
    Data(String),
    Resize(u16, u16),
    Kill,
}

pub struct TerminalManager {
    terminals: RwLock<HashMap<String, TerminalHandle>>,
    output_tx: mpsc::Sender<TerminalOutput>,
}

impl TerminalManager {
    pub fn new(output_tx: mpsc::Sender<TerminalOutput>) -> Self {
        Self {
            terminals: RwLock::new(HashMap::new()),
            output_tx,
        }
    }

    pub fn create_terminal(
        &self,
        working_dir: String,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();

        let pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let terminal_id = Uuid::new_v4().to_string();

        // Build the shell command
        let mut cmd = CommandBuilder::new(get_default_shell());
        cmd.cwd(&working_dir);

        // Set TERM for terminal capabilities (required for tmux and other TUI apps)
        cmd.env("TERM", "xterm-256color");

        // Set COLORTERM for true color support
        cmd.env("COLORTERM", "truecolor");

        // Preserve locale settings for UTF-8 support (required for tmux)
        if let Ok(lang) = std::env::var("LANG") {
            cmd.env("LANG", lang);
        }
        if let Ok(lc_all) = std::env::var("LC_ALL") {
            cmd.env("LC_ALL", lc_all);
        }
        if let Ok(lc_ctype) = std::env::var("LC_CTYPE") {
            cmd.env("LC_CTYPE", lc_ctype);
        }

        // Preserve HOME for config files (required for tmux)
        if let Ok(home) = std::env::var("HOME") {
            cmd.env("HOME", home);
        }

        // Preserve PATH for finding executables
        if let Ok(path) = std::env::var("PATH") {
            cmd.env("PATH", path);
        }

        // Preserve USER for proper shell behavior
        if let Ok(user) = std::env::var("USER") {
            cmd.env("USER", user);
        }

        // Spawn the shell in the slave PTY
        let _child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        // Get reader and writer
        let mut reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;
        let mut writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        // Create channel for input to the terminal
        let (input_tx, mut input_rx) = mpsc::unbounded_channel::<TerminalInput>();

        let info = TerminalInfo {
            id: terminal_id.clone(),
            working_dir: working_dir.clone(),
        };

        let handle = TerminalHandle {
            input_tx,
            info,
        };

        self.terminals.write().insert(terminal_id.clone(), handle);

        // Spawn a thread to read output from the PTY
        let output_tx = self.output_tx.clone();
        let tid = terminal_id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let output = TerminalOutput {
                            terminal_id: tid.clone(),
                            data,
                        };
                        if output_tx.blocking_send(output).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        // Spawn a thread to handle input to the PTY
        let master = pty_pair.master;
        thread::spawn(move || {
            while let Some(input) = input_rx.blocking_recv() {
                match input {
                    TerminalInput::Data(data) => {
                        if writer.write_all(data.as_bytes()).is_err() {
                            break;
                        }
                        let _ = writer.flush();
                    }
                    TerminalInput::Resize(cols, rows) => {
                        let _ = master.resize(PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                    }
                    TerminalInput::Kill => {
                        break;
                    }
                }
            }
        });

        Ok(terminal_id)
    }

    pub fn write_to_terminal(&self, terminal_id: &str, data: &str) -> Result<(), String> {
        let terminals = self.terminals.read();
        let handle = terminals
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        handle
            .input_tx
            .send(TerminalInput::Data(data.to_string()))
            .map_err(|_| "Failed to send input to terminal".to_string())
    }

    pub fn resize_terminal(&self, terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let terminals = self.terminals.read();
        let handle = terminals
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        handle
            .input_tx
            .send(TerminalInput::Resize(cols, rows))
            .map_err(|_| "Failed to send resize to terminal".to_string())
    }

    pub fn kill_terminal(&self, terminal_id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.write();
        let handle = terminals
            .remove(terminal_id)
            .ok_or_else(|| format!("Terminal {} not found", terminal_id))?;

        let _ = handle.input_tx.send(TerminalInput::Kill);
        Ok(())
    }

    pub fn list_terminals(&self) -> Vec<TerminalInfo> {
        self.terminals
            .read()
            .values()
            .map(|h| h.info.clone())
            .collect()
    }
}

fn get_default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}
