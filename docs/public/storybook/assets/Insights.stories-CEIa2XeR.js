import{c as e}from"./iframe-CnI2o-UJ.js";import{I as H}from"./Insights-BENmIw7T.js";import"./preload-helper-Dp1pzeXC.js";import"./AISummaryCard-C7yRgMUY.js";import"./aiSummaryCache-BSuJUHZx.js";import"./GlossaryText-C8CDyE6b.js";import"./index-CofT53Tl.js";import"./index-CeRDCxkJ.js";import"./button-C_rUzKqW.js";import"./utils-2dOUpm6k.js";import"./card-N1AUAA9K.js";const X={title:"Pages/Insights",component:H,tags:["autodocs","ai-generated"],parameters:{layout:"fullscreen"}},r=(t,a,o)=>q=>(t==="loading"?e.getSummary=()=>new Promise(()=>{}):t instanceof Error?e.getSummary=()=>Promise.reject(t):e.getSummary=()=>Promise.resolve({total_nights:30,nights_with_data:25,compliance_pct:85,avg_ahi:1.5,avg_pressure:10.2,ahi_trend:[],event_breakdown:{},...t}),a==="loading"?e.getImportSettings=()=>new Promise(()=>{}):a instanceof Error?e.getImportSettings=()=>Promise.reject(a):e.getImportSettings=()=>Promise.resolve({llm_configured:!0,...a}),o==="loading"?e.getAISummary=()=>new Promise(()=>{}):o instanceof Error?e.getAISummary=()=>Promise.reject(o):o!=null&&(e.getAISummary=()=>Promise.resolve({headline:"Excellent therapy performance.",therapy_quality:"Your sleep metrics indicate optimal therapy over the last 30 days.",high_confidence_observations:["AHI remains consistently below 2","Usage is consistently above 6 hours per night"],possible_patterns:["Minor leak spikes around 3 AM on weekends"],things_to_review:["Check mask fit to resolve sporadic leaks"],missing_or_uncertain:[],cached:!0,flag:"good",...o})),React.createElement("div",{className:"p-6"},React.createElement(q,null))),s={decorators:[r("loading","loading")]},n={decorators:[r(new Error("Failed to fetch summary data"),{llm_configured:!0})]},i={decorators:[r({nights_with_data:0},{llm_configured:!1})]},c={decorators:[r({nights_with_data:0},{llm_configured:!0})]},d={decorators:[r({nights_with_data:25},{llm_configured:!1})]},l={decorators:[r({nights_with_data:25},{llm_configured:!0},"loading")]},m={decorators:[r({nights_with_data:25},{llm_configured:!0},new Error("Failed to connect to LLM provider"))]},p={decorators:[r({nights_with_data:25},{llm_configured:!0},{})]};var g,u,_;s.parameters={...s.parameters,docs:{...(g=s.parameters)==null?void 0:g.docs,source:{originalSource:`{
  decorators: [createApiDecorator('loading', 'loading')]
}`,...(_=(u=s.parameters)==null?void 0:u.docs)==null?void 0:_.source}}};var h,f,A;n.parameters={...n.parameters,docs:{...(h=n.parameters)==null?void 0:h.docs,source:{originalSource:`{
  decorators: [createApiDecorator(new Error('Failed to fetch summary data'), {
    llm_configured: true
  })]
}`,...(A=(f=n.parameters)==null?void 0:f.docs)==null?void 0:A.source}}};var w,I,y;i.parameters={...i.parameters,docs:{...(w=i.parameters)==null?void 0:w.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 0
  }, {
    llm_configured: false
  })]
}`,...(y=(I=i.parameters)==null?void 0:I.docs)==null?void 0:y.source}}};var E,v,S;c.parameters={...c.parameters,docs:{...(E=c.parameters)==null?void 0:E.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 0
  }, {
    llm_configured: true
  })]
}`,...(S=(v=c.parameters)==null?void 0:v.docs)==null?void 0:S.source}}};var P,R,L;d.parameters={...d.parameters,docs:{...(P=d.parameters)==null?void 0:P.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 25
  }, {
    llm_configured: false
  })]
}`,...(L=(R=d.parameters)==null?void 0:R.docs)==null?void 0:L.source}}};var W,k,C;l.parameters={...l.parameters,docs:{...(W=l.parameters)==null?void 0:W.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 25
  }, {
    llm_configured: true
  }, 'loading')]
}`,...(C=(k=l.parameters)==null?void 0:k.docs)==null?void 0:C.source}}};var b,N,F;m.parameters={...m.parameters,docs:{...(b=m.parameters)==null?void 0:b.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 25
  }, {
    llm_configured: true
  }, new Error('Failed to connect to LLM provider'))]
}`,...(F=(N=m.parameters)==null?void 0:N.docs)==null?void 0:F.source}}};var M,j,x;p.parameters={...p.parameters,docs:{...(M=p.parameters)==null?void 0:M.docs,source:{originalSource:`{
  decorators: [createApiDecorator({
    nights_with_data: 25
  }, {
    llm_configured: true
  }, {})]
}`,...(x=(j=p.parameters)==null?void 0:j.docs)==null?void 0:x.source}}};const Z=["Loading","ErrorState","EmptyNoAIConfigured","EmptyWithAIConfigured","ReadyNoAIConfigured","ReadyWithAILoading","ReadyWithAIError","ReadyWithAI"];export{i as EmptyNoAIConfigured,c as EmptyWithAIConfigured,n as ErrorState,s as Loading,d as ReadyNoAIConfigured,p as ReadyWithAI,m as ReadyWithAIError,l as ReadyWithAILoading,Z as __namedExportsOrder,X as default};
