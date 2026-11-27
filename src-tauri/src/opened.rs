use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Manager, Runtime};

#[derive(Default)]
pub struct Opened(Mutex<Queue>);

#[derive(Default)]
struct Queue {
    waiting: Vec<PathBuf>,
    offered: Vec<Option<PathBuf>>,
}

pub fn arrive<R: Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    let Some(opened) = app.try_state::<Opened>() else { return };
    if paths.is_empty() {
        return;
    }
    opened.0.lock().unwrap().waiting.extend(paths);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.eval("window.formpathOpened && window.formpathOpened()");
    }
}

#[cfg(any(windows, target_os = "linux"))]
pub fn bring_forward<R: Runtime>(app: &tauri::AppHandle<R>) {
    if app.get_webview_window("splash").is_some() {
        return;
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

fn name(path: &Path) -> String {
    path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned()
}

#[tauri::command]
pub fn opened_take<R: Runtime>(app: tauri::AppHandle<R>) -> Vec<(usize, String)> {
    let opened = app.state::<Opened>();
    let mut queue = opened.0.lock().unwrap();
    let waiting = std::mem::take(&mut queue.waiting);
    waiting
        .into_iter()
        .map(|path| {
            let shown = name(&path);
            queue.offered.push(Some(path));
            (queue.offered.len() - 1, shown)
        })
        .collect()
}

#[tauri::command(async)]
pub fn opened_read<R: Runtime>(app: tauri::AppHandle<R>, id: usize) -> Result<tauri::ipc::Response, String> {
    let path = app
        .state::<Opened>()
        .0
        .lock()
        .unwrap()
        .offered
        .get_mut(id)
        .and_then(Option::take)
        .ok_or_else(|| "this file was handed over already.".to_string())?;
    std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => format!("there is no file at {}.", path.display()),
        _ => format!("{} could not be read ({err}).", path.display()),
    })
}
