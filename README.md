# M&M Toolkit

一个基于 Vue 3 + Express 的网页端 / 桌面端工具，用于：

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

## 环境变量

- `ENABLE_MISSEVAN=true` 或不设置：显示 `Missevan + Manbo`
- `ENABLE_MISSEVAN=false`：隐藏 `Missevan`，并禁用相关后端接口
- `MISSEVAN_COOLDOWN_HOURS=4`：线上环境猫耳 418 冷却时间，默认 4 小时
- `PORT`：服务监听端口，Render / Railway 会自动注入

## Render 部署

项目已包含 `render.yaml`，默认配置为：

- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- 推荐环境变量：`ENABLE_MISSEVAN=false`

部署完成后可以访问 `/app-config` 确认配置是否生效。

## Railway 部署

项目已整理为可直接部署到 Railway 的 Node Web 服务。

推荐配置：

- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Healthcheck Path: `/health`

推荐环境变量：

- 私用猫耳版：`ENABLE_MISSEVAN=true`
- 公开版：`ENABLE_MISSEVAN=false`
- `MISSEVAN_COOLDOWN_HOURS=4`

说明：

- Railway 部署时不需要运行 Electron
- 网页版入口始终是 `server.js`
- 只要 `npm start` 正常即可

## Windows 桌面版

项目保留 Electron 打包配置。

本地启动桌面版：

```bash
npm run desktop
```

打包 Windows 便携版：

```bash
npm run pack:win
```

输出文件位于：

- `release/M&M-Toolkit-<version>.exe`

说明：

- 桌面版会在本机内嵌启动 Express 服务
- `Missevan` 请求从用户自己的电脑发出，通常比云环境更稳定
- 图标文件为 `windowsapp.ico`
