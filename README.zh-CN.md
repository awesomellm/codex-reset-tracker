# Codex 重置追踪器核心

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [繁體中文](README.zh-HK.md)

可复用的 JavaScript 模块，用于规范化公开重置公告、保留来源、区分普通额度重置和储存重置次数，并描述历史间隔频率。仓库不包含账号访问、私人用量数据或真实历史数据整包。

## 本地运行

需要 Node.js 20 或更新版本，无依赖包：

```sh
git clone https://github.com/awesomellm/codex-reset-tracker.git
cd codex-reset-tracker
node --test reset.test.mjs
node example.mjs zh-CN
```

示例使用七条虚构事件和固定参考时间，不发起网络请求。五个仍符合条件的间隔中，两条落入接下来 48 小时窗口，得到描述性的 40% 频率。示例不是当前公告，不预测具体账号，也不是经过校准的概率。

## 模块

- `normalizeSnapshot`：验证数据记录、时间及来源，采用保守状态分类。
- `validateSnapshot`：验证已规范化快照，不更新其原始数据年龄。
- `forecastReset`：筛选相邻且符合条件的事件，返回计数、百分比或暂停输出的原因。
- `fetchResetSnapshot`：可选的公开数据读取，处理游标分页、最早生成时间及受限请求。导入模块和运行示例均不会读取网络。

[方法与限制](METHOD.zh-CN.md) 说明范围、样本门槛及条件频率公式。[类型声明](codex-reset.d.mts) 描述共享接口。代码标识符、分类原因及技术来源记录采用英文；文档与示例说明提供四种独立语言版本。

测试保留原实现的虚构事件分类、分页、不确定性、重复记录及数值检查。两项依赖网站真实历史数据的测试，改为虚构来源验证及公开事件范围测试。

可查看[简体中文在线追踪器](https://zequnweb.com/zh/tools/codex-reset-tracker/)及 [ZequnWeb](https://zequnweb.com/zh/)。软件采用 MIT 许可证（`LICENSE`）；第三方数据和服务条款与代码许可分开处理。
