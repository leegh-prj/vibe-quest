export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const key=process.env.OPENAI_API_KEY;
 if(!key)return res.status(503).json({error:'AI API 키가 아직 연결되지 않았습니다. 기본 학습 로드맵은 계속 이용할 수 있습니다.'});
 const {mode,project,type,level,question,stage,features}=req.body||{};
 if(!['roadmap','coach'].includes(mode))return res.status(400).json({error:'Invalid mode'});
 if(String(project||'').length>1200||String(question||'').length>1200)return res.status(400).json({error:'입력 글자 수를 줄여 주세요.'});
 const system='당신은 코딩 경험이 없는 사람의 실전 AI 개발 코치입니다. 쉬운 한국어로, 실제 구현을 위한 작고 검증 가능한 단계로 답하세요. 위험하거나 과장된 약속을 피하고, API 키·비밀번호를 채팅에 노출하지 않도록 안내하세요.';
 const prompt=mode==='roadmap'?
  '프로젝트: '+project+'\n종류: '+type+'\n학습자 수준: '+level+'\n현재 기능 후보: '+(features||[]).join(', ')+'\n이 프로젝트의 첫 MVP 범위와 7단계 실행 가능한 학습 로드맵을 제안해 주세요. 각 단계의 결과물, AI에 요청할 예시, 직접 테스트할 항목을 포함해 주세요. 1800자 이내로 작성하세요.':
  '프로젝트: '+project+'\n종류: '+type+'\n현재 단계: '+stage+'\n학습자 수준: '+level+'\n질문: '+question+'\n원인 파악 질문(필요 시), 바로 할 수 있는 다음 행동 1~3개, AI에 전달할 프롬프트, 확인할 테스트를 정리해 주세요. 코드를 직접 이해해야 한다고 강요하지 마세요. 1200자 이내.';
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:system,input:prompt,max_output_tokens:1300})});
  const json=await response.json();if(!response.ok)return res.status(502).json({error:'AI 응답에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'});
  const answer=(json.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  if(!answer)return res.status(502).json({error:'AI 답변을 생성하지 못했습니다.'});
  return res.status(200).json({answer});
 }catch{return res.status(502).json({error:'AI 서비스와 연결하지 못했습니다.'})}
}