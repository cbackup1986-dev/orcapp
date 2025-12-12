// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod services;
mod utils;

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Remove default menu on Windows to prevent "overflow menu"
            #[cfg(target_os = "windows")]
            {
                use tauri::menu::Menu;
                let menu = Menu::new(app)?;
                app.set_menu(menu)?;
            }

            // Initialize database
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            db::init_database(&app_data_dir).expect("Failed to initialize database");

            // Initialize recognition state
            let recognition_state = Arc::new(Mutex::new(commands::recognition::RecognitionState::new()));
            app.manage(recognition_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands
            commands::config::get_all_configs,
            commands::config::get_active_configs,
            commands::config::get_config_by_id,
            commands::config::get_default_config,
            commands::config::create_config,
            commands::config::update_config,
            commands::config::delete_config,
            commands::config::set_default_config,
            commands::config::test_connection,
            commands::config::test_connection_with_data,
            // History commands
            commands::history::get_history_records,
            commands::history::get_history_by_id,
            commands::history::delete_history,
            commands::history::delete_multiple_history,
            commands::history::clear_all_history,
            commands::history::export_history,
            // Template commands
            commands::template::get_all_templates,
            commands::template::get_default_template,
            commands::template::get_recent_templates,
            commands::template::create_template,
            commands::template::update_template,
            commands::template::delete_template,
            commands::template::increment_template_use,
            // Settings commands
            commands::settings::get_all_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            // Recognition commands
            commands::recognition::recognize,
            commands::recognition::cancel_recognition,
            // Dialog commands
            commands::dialog::select_image,
            commands::dialog::save_file,
            // Clipboard commands
            commands::clipboard::read_clipboard_image,
            commands::clipboard::write_clipboard_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
