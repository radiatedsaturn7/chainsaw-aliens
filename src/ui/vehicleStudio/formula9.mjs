// A small expression grammar for bounded geometry profiles; never executes JS.
const funcs={sin:[1,Math.sin],cos:[1,Math.cos],abs:[1,Math.abs],sqrt:[1,Math.sqrt],
 min:[2,Math.min],max:[2,Math.max],clamp:[3,(x,a,b)=>Math.max(a,Math.min(b,x))],
 mix:[3,(a,b,t)=>a+(b-a)*t],pow:[2,Math.pow],smooth:[1,x=>x*x*(3-2*x)]};
const vars=new Set(['u','v','x','t','side','theta','pi','z','y','chord','span']);
const cache=new Map();
export function compileFormula(source){
 if(typeof source!=='string'||source.length>240)throw Error('Profile formula must be at most 240 characters.');
 const s=source.trim();if(!s)return ()=>0;if(cache.has(s))return cache.get(s);
 const tokens=s.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[a-z][a-z0-9]*|[+*/^(),-]|[^\s]/g)??[];
 if(tokens.length>100)throw Error('Too many formula terms.');
 let i=0,depth=0;const next=()=>tokens[i++];
 const expect=x=>{if(next()!==x)throw Error('Expected '+x+' in profile formula.');};
 function atom(){
  if(++depth>24)throw Error('Formula nesting limit.');
  const a=next();let f;
  if(a==='('){f=add();expect(')');}
  else if(Number.isFinite(Number(a))&&Math.abs(Number(a))<=1e5){const n=Number(a);f=()=>n;}
  else if(Object.hasOwn(funcs,a)){
   const [n,func]=funcs[a],args=[];expect('(');
   for(let j=0;j<n;j++){if(j)expect(',');args.push(add());}
   expect(')');f=scope=>func(...args.map(q=>q(scope)));
  }else if(vars.has(a))f=scope=>a==='pi'?Math.PI:scope[a]??0;
  else throw Error('Unknown formula token: '+(a??'end of expression'));
  depth--;return f;
 }
 function power(){const a=atom();if(tokens[i]!=='^')return a;i++;const b=unary();return t=>a(t)**b(t);}
 function unary(){if(tokens[i]==='+'||tokens[i]==='-'){const s=next()==='-'?-1:1,f=unary();return t=>s*f(t);}return power();}
 function chain(next,ops){let a=next();while(ops.includes(tokens[i])){const op=tokens[i++],b=next(),old=a;
  a=op==='+'?(t=>old(t)+b(t)):op==='-'?(t=>old(t)-b(t)):op==='*'?(t=>old(t)*b(t)):(t=>old(t)/b(t));}return a;}
 function mul(){return chain(unary,['*','/']);} function add(){return chain(mul,['+','-']);}
 const expression=add();if(i!==tokens.length)throw Error('Unexpected formula token: '+tokens[i]);
 const fn=scope=>{const n=expression(scope??{});return Number.isFinite(n)?Math.max(-10,Math.min(10,n)):0;};
 if(cache.size>=192)cache.delete(cache.keys().next().value);cache.set(s,fn);return fn;
}
export const evalFormula=(source,scope)=>compileFormula(source)(scope);
