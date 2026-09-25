/* MAYNA homepage upgrade: no backend edits, uses existing /api/businesses. */
(()=>{
'use strict';
if(!document.querySelector('.hero') || !document.querySelector('main'))return;
const main=document.querySelector('main');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const section=(title,sub,pale=false)=>{const s=el('section','mh-section'+(pale?' mh-pale':''));const inner=el('div','mh-inner');s.append(inner);inner.append(el('h2','',title));if(sub)inner.append(el('p','mh-muted',sub));return {s,inner};};
const link=(label,href,cls='')=>{const a=el('a',cls,label);a.href=href;return a;};
const grid=()=>el('div','mh-grid');
const validImage=(v)=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='res.cloudinary.com'?u.href:null;}catch{return null;}};
const detail=(b)=>'business.html?id='+encodeURIComponent(String(b.id));
const listURL=(params)=>'businesses.html?'+new URLSearchParams(params).toString();
// 1. Smart search, including town filter. Existing hero search remains available.
const smart=section('Find a business near you','Search by name or service and optionally narrow results to a town.',true);
const form=el('form','mh-search');const search=el('input');search.placeholder='Business or service';search.setAttribute('aria-label','Business or service');search.maxLength=100;const town=el('input');town.placeholder='Town (optional)';town.setAttribute('aria-label','Town');town.maxLength=100;const submit=el('button','mh-btn','Search businesses');submit.type='submit';form.append(search,town,submit);form.addEventListener('submit',e=>{e.preventDefault();const p={};if(search.value.trim())p.search=search.value.trim();if(town.value.trim())p.town=town.value.trim();location.href=Object.keys(p).length?listURL(p):'businesses.html';});smart.inner.append(form);main.querySelector('.hero')?.after(smart.s);
// 2. Categories: augment existing category browsing with quick links.
const categories=section('Explore more categories','Jump directly to businesses offering the services you need.');const catGrid=grid();[['💻','Technology','ICT'],['🔧','Repairs','Repairs'],['🍽️','Food','Food'],['🚕','Transport','Transport'],['🏨','Accommodation','Accommodation'],['🏗️','Construction','Construction'],['✨','Beauty','Beauty'],['🎵','Entertainment','Entertainment']].forEach(([emoji,label,query])=>{const a=link('',listURL({search:query}),'mh-card mh-category');a.append(el('span','',emoji),el('strong','',label));catGrid.append(a);});categories.inner.append(catGrid);smart.s.after(categories.s);
// 3. Featured Premium already exists in original homepage. Add explanatory Premium placement note.
const existingFeatured=document.querySelector('#featuredBusinesses');if(existingFeatured){const note=el('p','mh-muted','Featured listings are selected from eligible MAYNA businesses.');existingFeatured.before(note);}
// 4. Town discovery: dynamic town counts from the existing public directory.
const towns=section('Explore by town','Find businesses in Namibian towns.',true),townGrid=grid();towns.inner.append(townGrid);const existingOwner=document.querySelector('.owner-section');if(existingOwner)existingOwner.before(towns.s);else main.append(towns.s);
// 5. Live statistics.
const stats=section('MAYNA in numbers','Figures come from the current public business directory.'),statGrid=grid();stats.inner.append(statGrid);towns.s.after(stats.s);
// 6. Stronger business registration CTA.
const cta=section('Grow with MAYNA','Help customers discover your business.');const banner=el('div','mh-cta');const copy=el('div');copy.append(el('h2','','Own a business?'),el('p','','Create a free listing or explore Premium options.'));const actions=el('div','mh-actions');actions.append(link('Register free','register.html','mh-btn'),link('Explore Premium','premium.html','mh-btn mh-btn-alt'));banner.append(copy,actions);cta.inner.append(banner);stats.s.after(cta.s);
// 7. Newly registered listings.
const recent=section('Recently added businesses','Discover new listings on MAYNA.',true),recentGrid=grid();recent.inner.append(recentGrid);cta.s.after(recent.s);
// 8. How MAYNA works.
const how=section('How MAYNA works','Three simple steps to find and contact a business.');const steps=grid();[['Search','Enter a service, category or town.'],['Explore','Compare public business listings and their services.'],['Connect','Open a business profile to find its available contact details.']].forEach(([h,p])=>{const c=el('article','mh-card mh-step');c.append(el('h3','',h),el('p','',p));steps.append(c);});how.inner.append(steps);recent.s.after(how.s);
const setMessage=(container,msg,isError=false)=>{container.replaceChildren(el('p',isError?'mh-error':'mh-muted',msg));};
const card=(b)=>{const c=el('article','mh-card');const img=validImage(b.image);if(img){const i=el('img');i.src=img;i.alt='';i.loading='lazy';c.append(i);}c.append(el('span','mh-pill',b.category||'Business'),el('h3','',b.businessName||'Business'),el('p','mh-muted',b.town||b.location||'Namibia'),link('View business →',detail(b)));return c;};
const stat=(num,label)=>{const c=el('div','mh-card mh-stat');c.append(el('strong','',String(num)),el('span','',label));return c;};
async function load(){try{
// Page through existing API (limit capped at 50). Cap scan to avoid excessive requests on large directories.
let all=[],page=1,total=0;do{const r=await fetch('/api/businesses?'+new URLSearchParams({page:String(page),limit:'50'}));if(!r.ok)throw Error('Directory unavailable');const j=await r.json();if(!j.success||!Array.isArray(j.businesses))throw Error('Invalid directory response');all.push(...j.businesses);total=Number(j.pagination?.total)||all.length;if(j.businesses.length===0)break;page++;}while(all.length<total&&page<=10);
const townMap=new Map(),categorySet=new Set();for(const b of all){const t=String(b.town||b.location||'').trim();if(t)townMap.set(t,(townMap.get(t)||0)+1);if(b.category)categorySet.add(b.category);}
statGrid.replaceChildren(stat(total,'Public business listings'),stat(townMap.size,'Towns represented in loaded listings'),stat(categorySet.size,'Categories represented in loaded listings'));
const ranked=[...townMap].sort((a,b)=>b[1]-a[1]).slice(0,8);if(!ranked.length)setMessage(townGrid,'Town listings will appear as businesses register.');else{townGrid.replaceChildren();ranked.forEach(([name,count])=>{const c=el('div','mh-card');c.append(el('h3','',name),el('p','mh-muted',count+' listing'+(count===1?'':'s')),link('Explore →',listURL({town:name})));townGrid.append(c);});}
const latest=[...all].filter(b=>b.createdAt).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);recentGrid.replaceChildren();if(latest.length)latest.forEach(b=>recentGrid.append(card(b)));else setMessage(recentGrid,'New businesses will appear here as listings become available.');
if(all.length<total){stats.inner.append(el('p','mh-muted','Town and category totals reflect the first '+all.length+' listings; more listings are available in Explore.'));}
}catch(e){console.error('MAYNA homepage additions:',e);setMessage(townGrid,'Unable to load towns right now.',true);setMessage(statGrid,'Unable to load live statistics right now.',true);setMessage(recentGrid,'Unable to load recent businesses right now.',true);}}
load();
})();
