(function(root){
'use strict';
const MAX_PROJECTS=30;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const text=(v,fallback='')=>typeof v==='string'?v:fallback;
const boolArray=v=>Array.isArray(v)?v.slice(0,7).map(Boolean):[];
const current=v=>Number.isInteger(v)&&v>=0&&v<=6?v:null;
function normalizeProject(source,helpers={}){
 const p=object(source);
 const goal=helpers.cleanGoalReviews||(()=>[]);
 const retry=helpers.cleanRetryLogs||(()=>({}));
 const starter=helpers.cleanStarterChecks||(()=>({}));
 return {
 type:text(p.type,'web'),description:text(p.description),experience:text(p.experience,'none'),tool:text(p.tool,'recommend'),
 done:boolArray(p.done),evidence:object(p.evidence),notes:object(p.notes),criteria:object(p.criteria),
 aiHistory:object(p.aiHistory),aiPlan:text(p.aiPlan),quizPassed:object(p.quizPassed),qa:object(p.qa),
 goalReviews:goal(p.goalReviews),retryLogs:retry(p.retryLogs),starterChecks:starter(p.starterChecks),
 activeId:text(p.activeId,'legacy'),current:current(p.current)
 };
}
function snapshot(source,helpers){return normalizeProject(source,helpers)}
function putProject(projects,project,max=MAX_PROJECTS){
 const list=Array.isArray(projects)?projects.slice():[];
 const index=list.findIndex(x=>x?.activeId===project.activeId);
 if(index>=0)list[index]=project;
 else if(list.length>=max)return {ok:false,projects:list};
 else list.push(project);
 return {ok:true,projects:list};
}
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const stageKeys=v=>Object.keys(v).every(k=>/^[0-6]$/.test(k));
const validTextMap=(v,max=20000)=>v===undefined||(isObject(v)&&stageKeys(v)&&Object.values(v).every(x=>typeof x==='string'&&x.length<=max));
const validBoolMap=v=>v===undefined||(isObject(v)&&stageKeys(v)&&Object.values(v).every(x=>typeof x==='boolean'));
const validCheckMap=(v,max)=>v===undefined||(isObject(v)&&stageKeys(v)&&Object.values(v).every(a=>Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==='boolean')));
const validHistory=v=>v===undefined||(isObject(v)&&stageKeys(v)&&Object.values(v).every(a=>Array.isArray(a)&&a.length<=12&&a.every(x=>isObject(x)&&typeof x.question==='string'&&x.question.length<=10000&&typeof x.answer==='string'&&x.answer.length<=25000)));
function validProject(p,types){
 if(!isObject(p)||!Object.hasOwn(types,p.type)||typeof p.description!=='string'||p.description.length>1200||!Array.isArray(p.done)||p.done.length>7||!p.done.every(x=>typeof x==='boolean'))return false;
 if(!validTextMap(p.evidence)||!validTextMap(p.notes)||!validBoolMap(p.quizPassed)||!validCheckMap(p.criteria,3)||!validCheckMap(p.qa,20)||!validHistory(p.aiHistory))return false;
 if(p.aiPlan!==undefined&&(typeof p.aiPlan!=='string'||p.aiPlan.length>50000))return false;
 if(p.goalReviews!==undefined&&(!Array.isArray(p.goalReviews)||p.goalReviews.length>3||!p.goalReviews.every(x=>isObject(x)&&['planned','built','tested'].includes(x.status)&&typeof x.evidence==='string'&&x.evidence.length<=600)))return false;
 if(p.starterChecks!==undefined&&!validCheckMap(p.starterChecks,2))return false;
 if(p.retryLogs!==undefined&&(!isObject(p.retryLogs)||!stageKeys(p.retryLogs)||!Object.values(p.retryLogs).every(a=>Array.isArray(a)&&a.length<=5&&a.every(x=>isObject(x)&&['retry','resolved'].includes(x.status)&&['problem','expected','before','after'].every(k=>x[k]===undefined||(typeof x[k]==='string'&&x[k].length<=500))))))return false;
 if(p.current!==undefined&&p.current!==null&&(!Number.isInteger(p.current)||p.current<0||p.current>6))return false;
 if(p.activeId!==undefined&&(typeof p.activeId!=='string'||p.activeId.length>150))return false;
 return true;
}
function validateBackup(payload,types){
 const d=payload?.data;
 return payload?.format==='vibequest-backup'&&payload.version===1&&validProject(d,types)&&Array.isArray(d.projects||[])&&(d.projects||[]).length<=MAX_PROJECTS&&(d.projects||[]).every(p=>validProject(p,types));
}
function restoreBackup(payload,types,helpers){
 if(!validateBackup(payload,types))throw Error('invalid backup');
 const project=normalizeProject(payload.data,helpers);
 return {...project,step:0,projects:(payload.data.projects||[]).map(x=>normalizeProject(x,helpers))};
}
function persist(storage,key,value){storage.setItem(key,JSON.stringify(value));return true}
root.VibeProjectStore=Object.freeze({MAX_PROJECTS,normalizeProject,snapshot,putProject,validateBackup,restoreBackup,persist});
})(window);
