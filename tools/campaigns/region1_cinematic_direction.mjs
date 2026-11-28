/**
 * Region 1 director's edit. Anchors use normalized coordinates in the existing
 * approved illustrations. "Hold" directions live between captions, not in the
 * dialogue, and are timed rather than blocking input.
 */
const coverage = (rob, cait, insert, alternate={}) => ({rob,cait,insert,...alternate});
const point = (x,y,z=2.05) => [x,y,z];
export const coverageByStill = {
 'garage-map': coverage(point(.36,.29),point(.64,.32),point(.52,.74,2.08)),
 'blue-hills-arrival': coverage(point(.35,.22),point(.64,.31),point(.56,.57,2.00)),
 'blue-hills-summit': coverage(point(.58,.47),point(.16,.45),point(.57,.31,1.85), {caitStill:'blue-hills-cait-close',insertStill:'blue-hills-boston-pov'}),
 'providence-return': coverage(null,null,point(.53,.65,1.55)),
 'providence-lab': coverage(point(.74,.28,2.1),point(.48,.38,2.1),point(.21,.47,1.85), {insertStill:'providence-salvage-close'}),
 'ri116-road-map': coverage(point(.81,.24),point(.19,.26),point(.50,.62,2.0)),
 'ri116-house': coverage(point(.37,.36),point(.20,.40),point(.76,.54,1.85), {robStill:'ri116-rob-close',caitStill:'ri116-cait-close',insertStill:'ri116-house-light'}),
 'ri44-convoy': coverage(null,null,point(.66,.36,1.78)),
 'ri44-roadside': coverage(point(.41,.39),point(.68,.46),point(.21,.39,1.95)),
 'pachaug-forest': coverage(point(.23,.23),point(.66,.36),point(.56,.65,1.90)),
 'pachaug-camp': coverage(point(.56,.29),point(.37,.32),point(.50,.70,1.92), {insertStill:'pachaug-cups-close'}),
 'thompson-grid': coverage(point(.36,.22),point(.67,.30),point(.17,.53,1.70)),
 'thompson-finish': coverage(point(.28,.43),point(.58,.23),point(.51,.61,1.75)),
 'boston-outskirts': coverage(point(.36,.25),point(.66,.35),point(.51,.76,1.90)),
 'boston-music-shop': coverage(point(.36,.25),point(.65,.27),point(.42,.58,1.82), {insertStill:'boston-guitar-close'}),
};
export const additionalStills = ['garage-m3-reveal','blue-hills-boston-pov','ri116-house-light','pachaug-map-close'];
const beat = (prefix, frame, {after, before, look, silence, alternate}={}) => ({prefix,frame,after,before,look,silence,alternate});
export const beatsByStill = {
 'garage-map': [
  beat('Here. Eventually.','insert',{before:420,after:520}),
  beat("You don't have to come, you know.",'cait',{before:480,after:890,look:'rob'}),
  beat("We need to change the tires",'rob',{before:500,after:600,look:'cait'}),
  beat("You still haven't sorted that thing.",'cait',{before:560,after:450}),
  beat("It's a nice car.",'cait',{before:540,after:890,look:'rob',alternate:'garage-m3-reveal'}),
 ],
 'blue-hills-arrival': [
  beat('Boston.','insert',{after:650}),
  beat("They're taking it apart.",'cait',{after:800,look:'insert'}),
  beat("California can wait another day.",'cait',{before:430,after:550,look:'rob'}),
 ],
 'blue-hills-summit': [
  beat('Jesus.','cait',{before:720,after:1100,look:'insert'}),
  beat('Why build something just to tear it down?','cait',{after:750,look:'rob'}),
  beat('Rob?','cait',{before:500,after:430,look:'rob'}),
  beat('Get in the car.','rob',{after:260}),
 ],
 'providence-return': [
  beat('Take the next left.','insert',{after:430}),
  beat('I know.','wide',{after:620}),
 ],
 'providence-lab': [
  beat('Rob?','cait',{before:820,after:640,look:'wide'}),
  beat('The bench is under there.','rob',{after:420,look:'wide'}),
  beat("There's a case on the left",'insert',{before:250,after:420,look:'cait'}),
  beat("They did it again.",'rob',{before:450,after:740,look:'cait'}),
  beat('Again.','rob',{before:980,after:1010,look:'wide'}),
  beat("We don't have to put it back",'cait',{after:570,look:'rob'}),
  beat("The BMW's still here.",'wide',{before:620,after:910,look:'rob'}),
 ],
 'ri116-road-map': [
  beat('Take this one.','insert',{before:470,after:410}),
  beat('Someone I used to love','rob',{before:840,after:980,look:'cait'}),
  beat('We can take the other road','cait',{before:470,after:640,look:'rob'}),
  beat('Could you pull over up ahead?','wide',{before:340,after:580}),
 ],
 'ri116-house': [
  beat('Used to park here.','wide',{before:580,after:470,look:'rob'}),
  beat('She always left that light on.','insert',{before:610,after:900,look:'rob'}),
  beat('What happened?','cait',{after:1250,look:'rob'}),
  beat('She went to Heaven.','rob',{after:1650,look:'cait',silence:true}),
  beat('Used to think about her every day.','rob',{before:670,after:920,look:'cait'}),
  beat("For what it's worth",'cait',{before:520,after:480,look:'rob'}),
 ],
 'ri44-convoy': [
  beat('Your hands were shaking','wide',{before:510,after:540}),
  beat('Do you reckon those are','insert',{before:520,after:540}),
  beat("Rob, they're closing the road!",'insert',{after:230}),
  beat("They're not trying anything",'wide',{after:720}),
 ],
 'ri44-roadside': [
  beat('Everybody alright?','cait',{before:450,after:430,look:'rob'}),
  beat("It didn't even stop.",'wide',{before:550,after:700,look:'cait'}),
  beat("Not being clever.",'rob',{before:600,after:590,look:'wide'}),
  beat('Pachaug it is.','wide',{before:400,after:650}),
 ],
 'pachaug-forest': [
  beat('The machines.','insert',{before:470,after:580}),
  beat("Knowing and caring aren't the same thing.",'wide',{after:820}),
 ],
 'pachaug-camp': [
  beat("I didn't mean for any of this to happen.",'insert',{before:900,after:650,look:'cait'}),
  beat('I meant leaving.','cait',{before:420,after:780,look:'rob'}),
  beat("I'm not.",'rob',{before:560,after:930,look:'insert'}),
  beat('There are a few roads up in New Hampshire','insert',{before:450,after:690,look:'rob',alternate:'pachaug-map-close'}),
  beat("I'll show you the map",'cait',{after:700,look:'wide'}),
 ],
 'thompson-grid': [
  beat('No, I mean properly.','cait',{after:410,look:'rob'}),
  beat('I bet I can kick your arse.','cait',{before:250,after:450,look:'rob'}),
  beat('Bring it.','rob',{before:430,after:740,look:'wide'}),
 ],
 'thompson-finish': [
  beat('Rematch?','cait',{after:460,look:'rob'}),
  beat('Start the fucking clock.','rob',{before:550,after:720,look:'wide'}),
 ],
 'boston-outskirts': [
  beat('Ran out of guitar strings.','rob',{before:500,after:410,look:'cait'}),
  beat('Alright. Let\'s go.','cait',{before:550,after:390,look:'rob'}),
  beat('A better guitarist.','cait',{after:550,look:'rob'}),
 ],
 'boston-music-shop': [
  beat('This one any good?','insert',{before:480,after:420}),
  beat('Play something.','cait',{before:400,after:570,look:'rob'}),
  beat('Then play something with four.','cait',{after:2050,look:'insert',silence:true}),
  beat("What's that?",'cait',{before:340,after:530,look:'rob'}),
  beat('Play it again.','cait',{before:540,after:1150,look:'insert'}),
 ],
};
// Existing editable project MIDI. Reuse project assets rather than importing
// tracks (which would require a new manifest and invalidate release seals).
const bed = (ref, normal, {arrival=420, tail=650, silence=.0, hush=.03}={}) =>
 ({ref, normal, arrival, tail, silence, hush});
export const scoreByScene = {
 'r1-blue-hills-intro':bed('intro2',.12),
 'r1-blue-hills-exit':bed('Creepy1',.11,{arrival:950}),
 'r1-providence-intro':bed('Creepy1',.13,{arrival:170}),
 'r1-providence-exit':bed('Creepy1',.085,{arrival:850}),
 'r1-ri116-intro':bed('bunnies',.095),
 'r1-ri116-exit':bed('bunnies',.075,{arrival:1150,tail:1050}),
 'r1-ri44-intro':bed('Creepy1',.11,{arrival:520}),
 'r1-ri44-exit':bed('Creepy1',.12,{arrival:150}),
 'r1-pachaug-intro':bed('bunnies',.12,{arrival:250}),
 'r1-pachaug-exit':bed('bunnies',.09,{arrival:860,tail:1100}),
 'r1-thompson-intro':bed('rock',.105,{arrival:180}),
 'r1-thompson-exit':bed('rock',.10,{arrival:140}),
 'r1-boston-intro':bed('Other',.10),
 'r1-boston-exit':bed('Other',.075,{arrival:650,tail:850}),
 'r1-garage-m3':bed('intro2',.085,{arrival:900}),
};
export const scoreRefs = [...new Set(Object.values(scoreByScene).map(({ref})=>ref))];
