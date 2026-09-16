// 宿主侧（cordis）入口：本插件不提供任何服务端能力，只作为 bundle 被
// dsh 加载，从而使 package.json 里的 dsh.client 声明（浏览器半侧）被
// dsh-client-modules 扫描并下发到前端。保持最小可加载即可。
export const inject = []

export function apply() {}
