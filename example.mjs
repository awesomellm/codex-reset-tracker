import {forecastReset} from './codex-reset.mjs';
const asOf='2026-09-13T12:00:00.000Z';
const messages={
 en:'Invented events at a fixed reference time. 2 of 5 surviving intervals fall within the next 48 hours: historical frequency 40%, not an account prediction.',
 'zh-CN':'固定参考时间的虚构事件。5 个仍符合条件的间隔中，2 个落在接下来 48 小时内：历史条件频率为 40%，不是个人账号预测。',
 ja:'固定した基準時刻の架空イベントです。残存する5区間中2区間が次の48時間内に入ります。履歴の条件付き頻度40%であり、個人アカウントの予測ではありません。',
 'zh-HK':'固定參考時間的虛構事件。5 個仍符合條件的間隔中，2 個落在接下來 48 小時內：歷史條件頻率為 40%，不是個人帳戶預測。'
};
const language=process.argv[2]||'en';
if(!messages[language]){console.error('node example.mjs en|zh-CN|ja|zh-HK');process.exitCode=2;}
else{
 const events=[-528,-504,-456,-384,-288,-168,-24].map((hours,i)=>({
  id:`synthetic-${i+1}`,announcedAt:new Date(Date.parse(asOf)+hours*3600000).toISOString(),
  type:'regular',status:'confirmed',summary:'Synthetic completed event',sourceUrl:`https://example.com/synthetic/${i+1}`,
  sourceKind:'observed',scope:'unspecified',roundId:`synthetic-${i+1}`,confirmationBasis:'completion-wording'
 }));
 const forecast=forecastReset(events,asOf,48,{scope:'public-reset-events',generatedAt:new Date(Date.parse(asOf)-3600000).toISOString(),historyComplete:true});
 console.log(JSON.stringify({synthetic:true,message:messages[language],forecast},null,2));
}
