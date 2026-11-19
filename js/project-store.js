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
function validateBackup(payload,types){
 const d=payload?.data, valid=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.hasOwn(types,p.type)&&typeof p.description==='string'&&p.description.length<=1200&&Array.isArray(p.done)&&p.done.length<=7;
 return payload?.format==='vibequest-backup'&&payload.version===1&&valid(d)&&Array.isArray(d.projects||[])&&(d.projects||[]).length<=MAX_PROJECTS&&(d.projects||[]).every(valid);
}
function restoreBackup(payload,types,helpers){
 if(!validateBackup(payload,types))throw Error('invalid backup');
 const project=normalizeProject(payload.data,helpers);
 return {...project,step:0,projects:(payload.data.projects||[]).map(x=>normalizeProject(x,helpers))};
}
function persist(storage,key,value){storage.setItem(key,JSON.stringify(value));return true}
root.VibeProjectStore=Object.freeze({MAX_PROJECTS,normalizeProject,snapshot,putProject,validateBackup,restoreBackup,persist});
})(window);
