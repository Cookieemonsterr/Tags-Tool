javascript:(function(){
const CH='saturn-tags-channel', LS_KEY='__SATURN_TAGS_JOBS__';
function parseJobs(text){
  // Accept formats:
  // 1) Label: tag1, tag2
  // 2) tag1, tag2            (label auto)
  // 3) Label => tag1 | tag2  (any separators , ; | or newlines)
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const jobs=[];
  let auto=1;
  for(const ln of lines){
    const m=ln.match(/^(.+?)(?:\s*[:=-]>\s*|\s*:\s*|\s*=>\s*)(.+)$/); // label + list
    let label, list;
    if(m){ label=m[1].trim(); list=m[2]; }
    else { label=`Job ${auto++}`; list=ln; }
    const tags=list.split(/[,\|\u061B;]+/).map(s=>s.trim()).filter(Boolean);
    if(tags.length) jobs.push({label,tags,status:'pending'});
  }
  return jobs;
}

const raw=prompt(
  "Paste jobs (one per line). Examples:\n" +
  "Store A: New Restaurants, Popular, Breakfast\n" +
  "Store B: Ice Cream | Waffles\n" +
  "just, two, tags"
);
if(!raw) return;
const jobs=parseJobs(raw);
if(!jobs.length){alert("No jobs parsed.");return;}

const perKeyDelay=Number(prompt("Typing delay per key (ms)?","100"))||100;
const postTypeWait=Number(prompt("Wait after selecting (ms)?","500"))||500;
const openWait=Number(prompt("Wait between dropdown open checks (ms)?","140"))||140;

const payload={jobs,perKeyDelay,postTypeWait,openWait};
const state={created_at:Date.now(),jobs:jobs};
localStorage.setItem(LS_KEY, JSON.stringify(state));

try{
  const bc=new BroadcastChannel('saturn-tags-channel');
  bc.postMessage({type:'SATURN_TAGS_JOBS',payload});
  alert(`📣 Sent ${jobs.length} job(s). Each listening tab will claim the next job automatically.`);
}catch(e){
  localStorage.setItem('__SATURN_TAGS_BCAST__', JSON.stringify({type:'SATURN_TAGS_JOBS',payload,ts:Date.now()}));
  alert(`📣 Sent via localStorage. ${jobs.length} job(s) queued.`);
}
})();
