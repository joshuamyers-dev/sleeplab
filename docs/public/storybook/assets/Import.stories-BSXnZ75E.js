import{I as O,O as i}from"./Import-B7QtmHUe.js";import{M as k}from"./iframe-CnI2o-UJ.js";import"./ChevronIcons-BVlKKS3A.js";import"./button-C_rUzKqW.js";import"./utils-2dOUpm6k.js";import"./card-N1AUAA9K.js";import"./preload-helper-Dp1pzeXC.js";const R={title:"Pages/Import",component:O,tags:["autodocs"],decorators:[b=>React.createElement(k,null,React.createElement(b,null))]},e={},s={name:"Oximeter Summary - Imported Only",render:()=>React.createElement("div",{className:"mx-auto max-w-2xl"},React.createElement(i,{result:{imported:2,skipped:0,unmatched:0,failed:0,results:[{filename:"2023-10-01_23-00-00.bin",status:"imported",message:"Matched to session",sample_count:28800},{filename:"2023-10-02_23-15-00.bin",status:"imported",message:"Matched to session",sample_count:27500}]}}))},a={name:"Oximeter Summary - Mixed with Skipped & Unmatched",render:()=>React.createElement("div",{className:"mx-auto max-w-2xl"},React.createElement(i,{result:{imported:1,skipped:2,unmatched:1,failed:0,results:[{filename:"2023-10-01_23-00-00.bin",status:"imported",message:"Matched to session",sample_count:28800},{filename:"2023-10-02_23-15-00.bin",status:"skipped",message:"Oximeter data already exists for this session"},{filename:"2023-10-03_23-30-00.bin",status:"skipped",message:"Oximeter data already exists for this session"},{filename:"2023-10-04_14-00-00.bin",status:"unmatched",message:"No CPAP session found at this time"}]}}))},t={name:"Oximeter Summary - Failures",render:()=>React.createElement("div",{className:"mx-auto max-w-2xl"},React.createElement(i,{result:{imported:0,skipped:0,unmatched:0,failed:3,results:[{filename:"corrupted_file_1.bin",status:"failed",message:"Invalid file signature"},{filename:"empty_file.bin",status:"failed",message:"File is empty"},{filename:"unknown_format.dat",status:"failed",message:"Unsupported format version"}]}}))},m={name:"Oximeter Summary - All States Combined",render:()=>React.createElement("div",{className:"mx-auto max-w-2xl"},React.createElement(i,{result:{imported:2,skipped:1,unmatched:1,failed:1,results:[{filename:"2023-10-01.bin",status:"imported",message:"Matched to session",sample_count:28800},{filename:"2023-10-02.bin",status:"imported",message:"Matched to session",sample_count:29100},{filename:"2023-10-03.bin",status:"skipped",message:"Already exists"},{filename:"2023-10-04.bin",status:"unmatched",message:"No CPAP session found"},{filename:"2023-10-05.bin",status:"failed",message:"Invalid file format"}]}}))};var r,n,o;e.parameters={...e.parameters,docs:{...(r=e.parameters)==null?void 0:r.docs,source:{originalSource:"{}",...(o=(n=e.parameters)==null?void 0:n.docs)==null?void 0:o.source}}};var d,l,u;s.parameters={...s.parameters,docs:{...(d=s.parameters)==null?void 0:d.docs,source:{originalSource:`{
  name: 'Oximeter Summary - Imported Only',
  render: () => <div className="mx-auto max-w-2xl">
      <OximeterImportSummary result={{
      imported: 2,
      skipped: 0,
      unmatched: 0,
      failed: 0,
      results: [{
        filename: '2023-10-01_23-00-00.bin',
        status: 'imported',
        message: 'Matched to session',
        sample_count: 28800
      }, {
        filename: '2023-10-02_23-15-00.bin',
        status: 'imported',
        message: 'Matched to session',
        sample_count: 27500
      }]
    }} />
    </div>
}`,...(u=(l=s.parameters)==null?void 0:l.docs)==null?void 0:u.source}}};var p,c,f;a.parameters={...a.parameters,docs:{...(p=a.parameters)==null?void 0:p.docs,source:{originalSource:`{
  name: 'Oximeter Summary - Mixed with Skipped & Unmatched',
  render: () => <div className="mx-auto max-w-2xl">
      <OximeterImportSummary result={{
      imported: 1,
      skipped: 2,
      unmatched: 1,
      failed: 0,
      results: [{
        filename: '2023-10-01_23-00-00.bin',
        status: 'imported',
        message: 'Matched to session',
        sample_count: 28800
      }, {
        filename: '2023-10-02_23-15-00.bin',
        status: 'skipped',
        message: 'Oximeter data already exists for this session'
      }, {
        filename: '2023-10-03_23-30-00.bin',
        status: 'skipped',
        message: 'Oximeter data already exists for this session'
      }, {
        filename: '2023-10-04_14-00-00.bin',
        status: 'unmatched',
        message: 'No CPAP session found at this time'
      }]
    }} />
    </div>
}`,...(f=(c=a.parameters)==null?void 0:c.docs)==null?void 0:f.source}}};var x,h,g;t.parameters={...t.parameters,docs:{...(x=t.parameters)==null?void 0:x.docs,source:{originalSource:`{
  name: 'Oximeter Summary - Failures',
  render: () => <div className="mx-auto max-w-2xl">
      <OximeterImportSummary result={{
      imported: 0,
      skipped: 0,
      unmatched: 0,
      failed: 3,
      results: [{
        filename: 'corrupted_file_1.bin',
        status: 'failed',
        message: 'Invalid file signature'
      }, {
        filename: 'empty_file.bin',
        status: 'failed',
        message: 'File is empty'
      }, {
        filename: 'unknown_format.dat',
        status: 'failed',
        message: 'Unsupported format version'
      }]
    }} />
    </div>
}`,...(g=(h=t.parameters)==null?void 0:h.docs)==null?void 0:g.source}}};var y,S,_;m.parameters={...m.parameters,docs:{...(y=m.parameters)==null?void 0:y.docs,source:{originalSource:`{
  name: 'Oximeter Summary - All States Combined',
  render: () => <div className="mx-auto max-w-2xl">
      <OximeterImportSummary result={{
      imported: 2,
      skipped: 1,
      unmatched: 1,
      failed: 1,
      results: [{
        filename: '2023-10-01.bin',
        status: 'imported',
        message: 'Matched to session',
        sample_count: 28800
      }, {
        filename: '2023-10-02.bin',
        status: 'imported',
        message: 'Matched to session',
        sample_count: 29100
      }, {
        filename: '2023-10-03.bin',
        status: 'skipped',
        message: 'Already exists'
      }, {
        filename: '2023-10-04.bin',
        status: 'unmatched',
        message: 'No CPAP session found'
      }, {
        filename: '2023-10-05.bin',
        status: 'failed',
        message: 'Invalid file format'
      }]
    }} />
    </div>
}`,...(_=(S=m.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const P=["Default","SummaryImportedOnly","SummaryWithSkippedAndUnmatched","SummaryWithFailures","SummaryAllStatesCombined"];export{e as Default,m as SummaryAllStatesCombined,s as SummaryImportedOnly,t as SummaryWithFailures,a as SummaryWithSkippedAndUnmatched,P as __namedExportsOrder,R as default};
