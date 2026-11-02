export async function load(url,context,next){
 const result=await next(url,context);
 if(!url.endsWith('/src/racing/CarWheelCylinder.js'))return result;
 return {...result,source:String(result.source).replace("if(ctx.__raceBoundsRecorder===true && ctx.__raceEmissive!==true){","if(false){")};
}
