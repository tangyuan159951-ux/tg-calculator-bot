class CalcError extends Error {}

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
class Q {
  constructor(n, d = 1n) {
    if (!d) throw new CalcError("不能除以 0");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); this.n = n / g; this.d = d / g;
  }
  add(x) { return new Q(this.n * x.d + x.n * this.d, this.d * x.d); }
  sub(x) { return new Q(this.n * x.d - x.n * this.d, this.d * x.d); }
  mul(x) { return new Q(this.n * x.n, this.d * x.d); }
  div(x) { if (!x.n) throw new CalcError("不能除以 0"); return new Q(this.n * x.d, this.d * x.n); }
}

function numberQ(s) {
  const neg = s.startsWith("-"); if (neg) s = s.slice(1);
  const [a, b = ""] = s.split(".");
  const d = 10n ** BigInt(b.length); const n = BigInt((a || "0") + b);
  return new Q(neg ? -n : n, d);
}

function normalize(s) {
  return s.trim().replace(/[＋]/g,"+").replace(/[－]/g,"-").replace(/[×乘]/g,"*")
    .replace(/乘以/g,"*").replace(/[÷]/g,"/").replace(/除以|除/g,"/")
    .replace(/[（]/g,"(").replace(/[）]/g,")").replace(/[％]/g,"%")
    .replace(/^(请|麻烦)?(帮我)?(计算|算一下|算算|算)[:：]?/, "").replace(/\s+/g, "");
}

function evaluate(input) {
  const src = normalize(input); const t = src.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/%]/g) || [];
  if (!src || t.join("") !== src) throw new CalcError("包含无法识别的字符");
  let i = 0; const peek = () => t[i]; const take = () => { if (i >= t.length) throw new CalcError("算式不完整"); return t[i++]; };
  const primary = () => { const x = take(); if (x === "(") { const v = expr(); if (take() !== ")") throw new CalcError("括号不匹配"); return v; } if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(x)) throw new CalcError("这里需要数字"); return numberQ(x); };
  const postfix = () => { let v = primary(); while (peek() === "%") { take(); v = v.div(new Q(100n)); } return v; };
  const unary = () => { if (peek() === "+") { take(); return unary(); } if (peek() === "-") { take(); const v = unary(); return new Q(-v.n, v.d); } return postfix(); };
  const term = () => { let v = unary(); while (["*","/"].includes(peek())) { const op = take(), r = unary(); v = op === "*" ? v.mul(r) : v.div(r); } return v; };
  const expr = () => { let v = term(); while (["+","-"].includes(peek())) { const op = take(), r = term(); v = op === "+" ? v.add(r) : v.sub(r); } return v; };
  const value = expr(); if (i !== t.length) throw new CalcError(`无法解析：${peek()}`); return [src, format(value)];
}

function format(q, digits = 200) {
  let n = q.n, sign = n < 0n ? "-" : ""; if (n < 0n) n = -n;
  const whole = n / q.d; let rem = n % q.d; if (!rem) return sign + whole;
  let out = "", seen = new Set();
  while (rem && out.length < digits) { const key = rem.toString(); if (seen.has(key)) break; seen.add(key); rem *= 10n; out += String(rem / q.d); rem %= q.d; }
  return sign + whole + "." + out + (rem ? "…" : "");
}

async function send(env, chatId, text) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({chat_id:chatId,text})});
}

async function telegram(update, env) {
  const m = update.message; if (!m?.text) return;
  const uid = m.from.id, cid = m.chat.id, text = m.text.trim();
  if (text === "/start" || text === "/help") return send(env,cid,"我是精准计算机器人。直接发送算式：\n(12.5+7.5)×3\n25%×480\n\n/history 最近记录\n/clear 清空记录");
  if (text === "/history") { const r = await env.DB.prepare("SELECT expression,result FROM history WHERE user_id=? ORDER BY id DESC LIMIT 10").bind(uid).all(); return send(env,cid,r.results.length ? "最近记录：\n"+r.results.map(x=>`${x.expression} = ${x.result}`).join("\n") : "还没有计算记录。"); }
  if (text === "/clear") { await env.DB.prepare("DELETE FROM history WHERE user_id=?").bind(uid).run(); return send(env,cid,"历史记录已清空。"); }
  try { const [e,r] = evaluate(text); await env.DB.prepare("INSERT INTO history(user_id,expression,result) VALUES(?,?,?)").bind(uid,e,r).run(); return send(env,cid,`${e} =\n${r}`); }
  catch (e) { return send(env,cid,"算式有问题："+(e instanceof CalcError ? e.message : "请检查输入")); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("OK");
    if (request.method === "POST" && url.pathname === "/" + env.WEBHOOK_PATH) { await telegram(await request.json(), env); return new Response("OK"); }
    return new Response("精准计算机器人正在运行");
  }
};
