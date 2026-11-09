// Compatibility for older installed template references; all resolve to saved assets.
export const GARAGE_SAVED_TIRES=['Stock','Street','Tarmac','Drift','Rally','Offroad','Rain','Snow'];
export function savedGarageTireRef(ref){
 const key=String(ref||'').replace(/^builtin:/,'').toLowerCase();
 return ({stock:'Stock',street:'Street',sport:'Street',tarmac:'Tarmac',drift:'Drift',dirt:'Rally',rally:'Rally',offroad:'Offroad',rain:'Rain',snow:'Snow'})[key]||ref;
}
