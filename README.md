# M&M Toolkit

一个基于 Vue 3 + Express 的网页端 / 桌面端小工具，用于：

- `Missevan` 的搜索、作品导入、弹幕统计、播放量统计、最低收益预估
- `Manbo` 的作品导入、分集筛选、弹幕统计、去重 ID 统计

## 本地启动

```bash
npm install
npm run build
npm start
```

启动后访问 `http://localhost:3000`。

## 猫耳访问受限说明

如果 `Missevan` 显示“访问受限”：

1. 使用任意浏览器打开 `https://www.missevan.com/`
2. 完成猫耳要求的验证
3. 回到工具页面重新尝试

Windows 桌面版会直接在界面中提示这一步。

## 线上版隐藏 Missevan

项目支持运行时开关：

- `ENABLE_MISSEVAN=true` 或不设置：显示 `Missevan + Manbo`
- `ENABLE_MISSEVAN=false`：隐藏 `Missevan`，并禁用相关后端接口

这个开关适合公开部署时只保留 `Manbo`。

## 418 冷却时间

线上版在首次触发猫耳 `418` 后，会进入冷却期，在冷却结束前不再继续请求猫耳。

- 环境变量：`MISSEVAN_COOLDOWN_HOURS`
- 默认值：`4`

例如：

```bash
MISSEVAN_COOLDOWN_HOURS=4
```

## Render 部署

推荐环境变量：

- `ENABLE_MISSEVAN=false`
- `MISSEVAN_COOLDOWN_HOURS=4`

项目已包含 [render.yaml](/f:/VSProjects/MissevanWebApp/missevan-id-count/render.yaml)，默认配置为：

- Build Command: `npm install && npm run build`
- Start Command: `npm start`

部署完成后可以访问 `/app-config` 确认当前配置是否生效。

## Windows EXE 打包

项目已包含 Electron 打包配置。

安装依赖：

```bash
npm install
```

本地启动桌面版：

```bash
npm run desktop
```

打包 Windows 便携版 EXE：

```bash
npm run pack:win
```

输出文件位于：

- `release/M&M-Toolkit-<version>.exe`

说明：

- 桌面版会在本机内嵌启动 Express 服务
- `Missevan` 请求会从用户自己的电脑发出，比公共云环境更稳定
- Windows 桌面版图标使用 `windowsapp.ico`
