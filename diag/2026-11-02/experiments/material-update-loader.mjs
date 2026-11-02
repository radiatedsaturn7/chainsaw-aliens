// Opt-in test-only integration. Does not modify the served source files.
import {registerHooks} from 'node:module';
const helper=new URL('./material-update-candidate.mjs',import.meta.url).href;
const before=`      for (const key in material) delete material[key];
      if (cell) {
        for (const key in cell) material[key] = cell[key];
      }`;
registerHooks({load(url,context,next){
 const result=next(url,context);
 if(!url.endsWith('/src/racing/RaceSimulation.js'))return result;
 let source=String(result.source);
 if(source.split(before).length!==2)throw Error('Player material update source changed');
 source=`import {updateMaterialCell} from '${helper}';\n`+source.replace(before,'      updateMaterialCell(material, cell);');
 return {...result,source};
}});
