use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};

/// 显示并激活主窗口：解除最小化 → 显示 → 聚焦。
/// 浮窗 home 图标和托盘菜单共用这一条路径，避免逻辑分叉。
fn bring_main_to_front(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// 供前端浮窗 home 图标调用：与托盘/单实例共用同一套唤起逻辑，
/// 不再依赖 JS 侧的 WebviewWindow.getByLabel（打包后易因时序失效）。
#[tauri::command]
fn show_main_window(app: AppHandle) {
    bring_main_to_front(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![show_main_window])
        // 单实例：二次启动时把参数交给已运行实例并唤起主窗口，新进程随即退出。
        // 这样托盘/浮窗反复点击、用户重复双击 exe 都不会产生第二个进程或多个托盘图标。
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            bring_main_to_front(app);
        }))
        .setup(|app| {
            // 关键修复：接管主窗口的关闭请求。
            // 默认行为会「销毁」main 窗口，导致前端 getByLabel('main') 返回 null，
            // 浮窗 home 图标再也找不到主窗口。改为拦截 close 并隐藏，窗口对象保留在
            // 窗口表中，show/unminimize/focus 才能重新唤起；同时程序不会因关窗而退出。
            if let Some(main) = app.get_webview_window("main") {
                let main_for_hide: WebviewWindow = main.clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_for_hide.hide();
                    }
                });
            }

            // 托盘菜单：打开主窗口 / 退出应用。
            let show_item = MenuItemBuilder::with_id("show_main", "打开主窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出应用").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            // 左键点击托盘直接唤起主窗口，右键/菜单走菜单项；menu_on_left_click(false)
            // 保证左键不再弹菜单，两种行为互不冲突。
            let tray = TrayIconBuilder::new()
                .icon(
                    // 托盘只需 16/32px，直接用 32px 资源，避免拿 512px 的 default_window_icon
                    // 让系统硬缩到 16px 而糊成一团。
                    tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))
                        .expect("托盘图标解码失败"),
                )
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show_main" => bring_main_to_front(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        bring_main_to_front(tray.app_handle());
                    }
                })
                .build(app)?;

            // 退出时由 Tauri 统一销毁托盘图标；这里保留句柄以防被提前 drop 影响事件回调。
            app.manage(tray);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
