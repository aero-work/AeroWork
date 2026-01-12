use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: Option<String>,
}

fn detect_language(path: &str) -> Option<String> {
    let ext = path.rsplit('.').next()?;
    let lang = match ext.to_lowercase().as_str() {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "c" | "h" => "c",
        "cpp" | "cc" | "cxx" | "hpp" => "cpp",
        "cs" => "csharp",
        "rb" => "ruby",
        "php" => "php",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "scala" => "scala",
        "html" | "htm" => "html",
        "css" | "scss" | "sass" | "less" => "css",
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "xml" => "xml",
        "md" | "markdown" => "markdown",
        "sql" => "sql",
        "sh" | "bash" | "zsh" => "shell",
        "dockerfile" => "dockerfile",
        "graphql" | "gql" => "graphql",
        "vue" => "vue",
        "svelte" => "svelte",
        _ => return None,
    };
    Some(lang.to_string())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

fn should_ignore(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".svn"
            | "__pycache__"
            | ".DS_Store"
            | "Thumbs.db"
    )
}

#[command]
pub async fn list_directory(path: String, show_hidden: bool) -> Result<Vec<FileEntry>, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored directories
        if should_ignore(&name) {
            continue;
        }

        // Skip hidden files unless requested
        let hidden = is_hidden(&name);
        if hidden && !show_hidden {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_dir = metadata.is_dir();
        let size = if is_dir { None } else { Some(metadata.len()) };
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
            is_hidden: hidden,
            size,
            modified,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // Check file size (limit to 10MB)
    let metadata = fs::metadata(&file_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("File is too large (max 10MB)".to_string());
    }

    let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let language = detect_language(&path);

    Ok(FileContent {
        path,
        content,
        language,
    })
}

#[command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    fs::write(&file_path, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[command]
pub async fn create_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    if file_path.exists() {
        return Err(format!("File already exists: {}", path));
    }

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    fs::write(&file_path, "").map_err(|e| format!("Failed to create file: {}", e))?;

    Ok(())
}

#[command]
pub async fn create_directory(path: String) -> Result<(), String> {
    let dir_path = PathBuf::from(&path);

    if dir_path.exists() {
        return Err(format!("Directory already exists: {}", path));
    }

    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    Ok(())
}

#[command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let target_path = PathBuf::from(&path);

    if !target_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    if target_path.is_dir() {
        fs::remove_dir_all(&target_path).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(&target_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

#[command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);

    if !old.exists() {
        return Err(format!("Path does not exist: {}", old_path));
    }

    if new.exists() {
        return Err(format!("Target path already exists: {}", new_path));
    }

    fs::rename(&old, &new).map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}
