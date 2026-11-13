// Fictional records are created only by the demo branch. Dates stay relative to the visit.
function sampleApplyDesk() {
  const day=n=>localISO(new Date(Date.now()+n*864e5));
  const answers=[
    ['name','Full name','姓名','Sam Example'],['city','Current city','现居城市','Vancouver, BC'],
    ['sponsor','Sponsorship required','是否需要雇主担保','No'],
    ['experience','Relevant experience','相关经验','Operations reporting in SQL and Looker, with Python for scheduling analysis.'],
    ['analysis','An analysis that changed a decision','影响决策的分析','I rebuilt the weekly throughput report at Harbourline Logistics. The new SQL model separated dock delays from loading time, so the team could change the peak-hour schedule. Truck waits fell by a fifth.'],
    ['tools','Tools','常用工具','SQL, Python (pandas), Excel, Looker, Tableau'],['start','Available to start','可入职时间','Two weeks after accepting an offer'],
    ['workplace','Work arrangement','办公方式','Available for hybrid work in Vancouver'],['portfolio','Portfolio','作品集','https://example.com/sam'],
    ['note','Anything else','补充说明','I enjoy turning an operational question into a clear, repeatable report.'],
  ].map(([id,en,zh,text])=>({id,label:{en,zh},text}));
  // an open kit closes in nine days and was prepared yesterday; a kit already sent (sentDaysAgo) carries no deadline
  const make=(id,company,role,jobId,sentDaysAgo=null)=>({id,company,role,location:'Vancouver, BC',postingUrl:`https://example.com/jobs/${id}`,jobRef:{region:'canada',id:jobId},...(sentDaysAgo==null?{deadline:day(9),applyDate:day(1)}:{}),preparedAt:new Date(Date.now()-864e5*(sentDaysAgo==null?1:sentDaysAgo+1)).toISOString(),
    resume:{path:`data/apply-kits/${id}/sam-example-resume.pdf`,reason:{en:'Selected for SQL reporting, operations analysis and measurable decisions.',zh:'突出 SQL 报表、运营分析和可衡量的决策结果。'}},
    coverLetter:`Dear hiring team,\n\nI am applying for the ${role} role at ${company}. At Harbourline Logistics, I rebuilt the weekly throughput report in SQL and Looker. What had taken two hours became a thirty-minute review, giving operations staff more time to act on the findings.\n\nI also modelled dock scheduling in Python. By separating loading time from arrival patterns, I helped the team change its peak-hour schedule and reduce truck waits by a fifth. At Saltmarsh Policy Lab I cleaned and documented a 12,000-row housing survey, with careful checks so others could reproduce the results.\n\nYour role calls for someone who can connect reliable analysis to everyday decisions. I would bring practical SQL and Python skills, clear reporting, and a habit of asking what a result will change. I would welcome the chance to discuss the team’s current reporting questions.\n\nThank you for your time,\nSam Example`,answers,actions:[{id:'review',date:day(sentDaysAgo==null?0:-sentDaysAgo-1),minutes:10,title:{en:'Review the tailored resume',zh:'核对定制简历'},outcome:{en:'Check the dates and the two reporting results.',zh:'确认日期和两项报表成果准确。'}}],
    steps:[{en:'Download the selected resume and attach it to the employer’s form.',zh:'下载所选简历，并上传到雇主的表单。'},{en:'Copy the answers in form order. Review each answer before submitting.',zh:'按表单顺序复制答案，提交前逐项核对。'},{en:'Complete the robot check and press Submit. Then mark this application sent.',zh:'完成人机验证后提交，再回来标记已投递。'}],
    fit:{en:'SQL, Python and operations reporting match. No production dbt experience is claimed.',zh:'SQL、Python 和运营报表经验匹配。没有声称具备生产环境 dbt 经验。'},reviewNote:{en:'Fictional sample. The answers use only Sam’s sample profile.',zh:'虚构示例，答案只使用 Sam 的示例资料。'},sideDoor:{en:'Apply through the employer’s form.',zh:'通过雇主的申请表单投递。'},formNote:{en:'Paste the exact answer into the matching field.',zh:'将答案复制到对应的表单字段。'},sources:[{label:{en:'Sample profile',zh:'示例资料'},url:'https://example.com/sam'}]});
  const handoff=make('demo-handoff','Northwind Analytics','Data Analyst','demo1');
  handoff.handoff={updatedAt:new Date().toISOString(),steps:[{id:'robot-submit',kind:'robot-check',text:{en:'Tick the robot check, then press Submit',zh:'勾选人机验证，然后点提交'},url:handoff.postingUrl}]};
  const ready=make('demo-ready','Kittiwake Freight','Reporting Analyst','demo-saved-0');
  const sent=make('demo-sent','Cascade Health','Business Intelligence Analyst','demo3');
  // three more kits in the states a search is mostly made of: sent and waiting, sent with no reply, and closed
  const jobs=sampleJobs('canada'),job=id=>jobs.find(j=>j.id===id),at=n=>new Date(Date.now()-n*864e5).toISOString();
  const waiting=make('demo-waiting',job('demo-waiting-1').company,job('demo-waiting-1').role,'demo-waiting-1',5);
  const quiet=make('demo-quiet',job('demo-waiting-7').company,job('demo-waiting-7').role,'demo-waiting-7',23);
  const closed=make('demo-closed','Glacier Capital','Investment Analyst','demo5',20);
  return {kits:[handoff,ready,sent,waiting,quiet,closed],progress:[
    {id:sent.id,appliedAt:at(8),appliedDate:day(-8),outcome:'interview',outcomeDate:day(-1),outcomeNote:'Second round Thursday'},
    {id:waiting.id,appliedAt:job('demo-waiting-1').appliedAt,appliedDate:day(-5)},
    {id:quiet.id,appliedAt:job('demo-waiting-7').appliedAt,appliedDate:day(-23)},
    {id:closed.id,appliedAt:at(20),appliedDate:day(-20),outcome:'declined',outcomeDate:day(-6),outcomeNote:'A polite no after the screening call.'},
  ]};
}
function sampleTailoredResume(kit) {
  return renderResumePDF({name:'Sam Example',contact:'Vancouver, BC · sam@example.com · example.com/sam',sections:[
    {title:`PROFILE · ${kit.role}`,type:'text',entries:[{org:'Profile',bullets:['Operations analyst with SQL, Python and Looker experience. Builds reproducible reporting that helps teams make everyday decisions.']}]},
    {title:'SKILLS',type:'skills',entries:[{label:'Analysis',items:'SQL, Python (pandas), Excel'},{label:'Reporting',items:'Looker, Tableau'}]},
    {title:'EXPERIENCE',type:'experience',entries:[{date:'Apr 2026 – Present',role:'Operations Analyst',org:'Harbourline Logistics',bullets:['Rebuilt weekly throughput reporting in SQL and Looker, reducing a two-hour review to thirty minutes.','Modelled dock scheduling in Python. Peak-hour truck waits fell by a fifth.']},{date:'Jul – Sep 2026',role:'Research Assistant',org:'Saltmarsh Policy Lab',bullets:['Cleaned and documented a 12,000-row housing survey for a policy brief.']}]},
  ]});
}
