"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import InventoryImporter from "./InventoryImporter";
import OvenImporter from "./OvenImporter";

type Material = { name: string; quantity: number };
type Recipe = { id: string; name: string; category: string; output: number; materials: Material[] };
type Stock = Record<string, number>;
type Project = { id: string; recipeId: string; quantity: number; completed: number; created: string };
type History = { id: string; text: string; at: string };
type OvenJob = { id: string; name: string; quantity: number; remaining: string; character: number };
type Settings = { skill: number; citadel: number; decryptor: number; builder: number; rorqualLoadValue?: number };
type Store = { stock: Stock; prices: Record<string, number>; priceUpdated?: string; recipes: Recipe[]; projects: Project[]; ovens: OvenJob[]; history: History[]; settings: Settings };

const starterRecipes: Recipe[] = [
  { id: "demo-venture", name: "Venture III", category: "Ship", output: 1, materials: [
    { name: "Tritanium", quantity: 153600 }, { name: "Pyerite", quantity: 36864 },
    { name: "Mexallon", quantity: 9216 }, { name: "Isogen", quantity: 2304 }
  ]},
  { id: "demo-component", name: "Construction Component", category: "Commodity", output: 1, materials: [
    { name: "Tritanium", quantity: 12000 }, { name: "Pyerite", quantity: 3000 }
  ]}
];

const emptyStore: Store = {
  stock: {}, prices: {}, recipes: starterRecipes, projects: [], ovens: [], history: [],
  settings: { skill: 0.95, citadel: 0, decryptor: 0, builder: 0 }
};
const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString("en-GB");
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const piNames = new Set(["Lustering Alloy","Sheen Compound","Gleaming Alloy","Condensed Alloy","Precious Alloy","Motley Compound","Fiber Composite","Lucent Compound","Opulent Compound","Glossy Compound","Crystal Compound","Dark Compound","Reactive Gas","Noble Gas","Base Metals","Heavy Metals","Noble Metals","Reactive Metals","Toxic Metals","Industrial Fibers","Supertensile Plastics","Polyaramids","Coolant","Condensates","Construction Blocks","Nanites","Silicate Glass","Smartfab Units","Precious Metals","Non-CS Crystals","Polytextiles","Oxygen Isotopes","Heavy Water","Ionic Solutions","Liquid Ozone","Plasmoids"]);
const rorqualLoad: Record<string, number> = {
  "Rich Mercoxit": 1858*2.5, "Rich Bistot": 2811*2.5, "Rich Gneiss": 18873*2.5,
  "Rich Arkonor": 2056*2.5, "Rich Crokite": 2790*2.5, "Rich Dark Ochre": 1803*2.5,
  "Rich Spodumain": 11277*2.5, "Rich Hemorphite": 4018*2.5, "Rich Hedbergite": 6530*2.5,
  "Rich Jaspet": 3400*2.5, "Rich Pyroxeres": 53521*2.5, "Rich Veldspar": 71756*2.5,
  "Rich Scordite": 26275*2.5, "Compressed Fullerite-C50": 5340*2.5,
  "Compressed Fullerite-C60": 5886*2.5
};

export default function Home() {
  const [store, setStore] = useState<Store>(emptyStore);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [recipeCategory, setRecipeCategory] = useState("Ship");
  const [recipeMaterials, setRecipeMaterials] = useState<Material[]>([{ name: "", quantity: 0 }]);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [buildQty, setBuildQty] = useState(1);
  const [sharedState, setSharedState] = useState("Connecting shared crew…");
  const [sharedReady, setSharedReady] = useState(false);
  const [catalogState, setCatalogState] = useState("Loading Echoes.mobi catalogue…");
  const [itemIcons, setItemIcons] = useState<Record<string,string>>({});
  const importRef = useRef<HTMLInputElement>(null);
  const lastSharedPayload = useRef("");

  useEffect(() => {
    const saved = localStorage.getItem("echoes-foundry-v1");
    if (saved) try { const value=JSON.parse(saved); setStore({ ...emptyStore, ...value, prices:value.prices||{} }); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem("echoes-foundry-v1", JSON.stringify(store)); }, [store, ready]);
  useEffect(() => { if(ready) fetch("/api/prices").then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(data.prices&&Object.keys(data.prices).length)setStore(s=>({...s,prices:data.prices,priceUpdated:data.updatedAt}))}).catch(()=>{}); }, [ready]);
  useEffect(() => { if(ready) fetch("/api/items").then(r=>r.json()).then(raw=>{const rows=Array.isArray(raw)?raw:raw["hydra:member"]||raw.items||raw.data||[];const icons:Record<string,string>={};rows.forEach((x:Record<string,unknown>)=>{if(x.name&&x.icon_url)icons[String(x.name)]=String(x.icon_url)});setItemIcons(icons)}).catch(()=>{}); }, [ready]);
  useEffect(()=>{if(!ready||!supabase)return;let active=true;(async()=>{const {data,error}=await supabase.from("foundry_state").select("payload").eq("sync_code","shared-crew-main").maybeSingle();if(!active)return;if(error){setSharedState("Shared save unavailable");return}if(data?.payload){try{const value=JSON.parse(String(data.payload));lastSharedPayload.current=String(data.payload);setStore({...emptyStore,...value,prices:value.prices||{},ovens:value.ovens||[]});setSharedState("Shared crew connected")}catch{setSharedState("Shared save needs reset")}}else{const payload=JSON.stringify(store);await supabase.from("foundry_state").upsert({sync_code:"shared-crew-main",payload,updated_at:new Date().toISOString()});lastSharedPayload.current=payload;setSharedState("Shared crew created")}setSharedReady(true)})();return()=>{active=false}},[ready]);
  useEffect(()=>{if(!sharedReady||!supabase)return;const timer=setTimeout(async()=>{const payload=JSON.stringify(store);if(payload===lastSharedPayload.current)return;const {error}=await supabase.from("foundry_state").upsert({sync_code:"shared-crew-main",payload,updated_at:new Date().toISOString()},{onConflict:"sync_code"});if(!error){lastSharedPayload.current=payload;setSharedState("Shared crew saved")}},900);return()=>clearTimeout(timer)},[store,sharedReady]);
  useEffect(()=>{if(!sharedReady||!supabase)return;const timer=setInterval(async()=>{const {data}=await supabase.from("foundry_state").select("payload").eq("sync_code","shared-crew-main").maybeSingle();if(data?.payload&&String(data.payload)!==lastSharedPayload.current){try{lastSharedPayload.current=String(data.payload);const value=JSON.parse(String(data.payload));setStore({...emptyStore,...value,prices:value.prices||{},ovens:value.ovens||[]});setSharedState("Shared crew updated")}catch{}}},5000);return()=>clearInterval(timer)},[sharedReady]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) throw new Error();
        const raw = await response.json();
        const rows = Array.isArray(raw) ? raw : raw["hydra:member"] || raw.member || raw.items || raw.data || [];
        const mapped: Recipe[] = rows.map((row: Record<string, unknown>, index: number) => {
          const product = (row.item || row.product || row.output || {}) as Record<string, unknown>;
          const rawMaterials = (row.materials || row.resources || row.inputs || []) as Array<Record<string, unknown>>;
          const materials = Array.isArray(rawMaterials) ? rawMaterials.map(m => {
            const item = (m.item || m.material || m.resource || {}) as Record<string, unknown>;
            return { name: String(item.name || m.name || m.itemName || "Unknown material"), quantity: Number(m.quantity || m.amount || m.count || 0) };
          }).filter(m => m.quantity > 0 && m.name !== "Unknown material") : [];
          return { id: `echoes-${String(row.id || product.id || index)}`, name: String(product.name || row.name || row.itemName || row.blueprintName || ""), category: String(product.category || row.category || row.type || "Blueprint"), output: Number(row.outputQuantity || row.quantity || 1), materials };
        }).filter((r: Recipe) => r.name && r.materials.length);
        if (!cancelled && mapped.length) {
          setStore(s => ({ ...s, recipes: [...s.recipes.filter(r => !r.id.startsWith("echoes-")), ...mapped] }));
          setCatalogState(`${mapped.length.toLocaleString("en-GB")} Echoes.mobi blueprints loaded`);
        } else if (!cancelled) setCatalogState("Catalogue connected; no compatible recipes returned");
      } catch { if (!cancelled) setCatalogState("Echoes.mobi catalogue temporarily unavailable"); }
    })();
    return () => { cancelled = true; };
  }, [ready]);

  const multiplier = store.settings.skill * (1 - store.settings.citadel) * (1 - store.settings.decryptor);
  const requirements = useMemo(() => {
    const out: Record<string, number> = {};
    store.projects.forEach(p => {
      const r = store.recipes.find(x => x.id === p.recipeId);
      if (!r) return;
      const left = Math.max(0, p.quantity - p.completed);
      r.materials.forEach(m => out[m.name] = (out[m.name] || 0) + Math.ceil(m.quantity * left * multiplier));
    });
    return out;
  }, [store.projects, store.recipes, multiplier]);
  const missing = Object.entries(requirements).filter(([name, qty]) => (store.stock[name] || 0) < qty);
  const progress = store.projects.length ? Math.round(store.projects.reduce((a,p)=>a+p.completed,0) / Math.max(1,store.projects.reduce((a,p)=>a+p.quantity,0)) * 100) : 0;
  const inventoryValue=Object.entries(store.stock).reduce((sum,[name,qty])=>sum+qty*(store.prices[name]||0),0);
  const shortageValue=missing.reduce((sum,[name,qty])=>sum+Math.max(0,qty-(store.stock[name]||0))*(store.prices[name]||0),0);
  const automaticLoadValue=Object.entries(rorqualLoad).reduce((sum,[name,qty])=>sum+qty*(store.prices[name]||0),0)*0.615*0.9;
  const isk=(n:number)=>Math.round(n).toLocaleString("en-GB")+" ISK";
  const filteredRecipes = store.recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  const selectedBuild = store.recipes.find(r => r.id === selectedRecipe);
  const expandedMissing = useMemo(() => {
    const available:Record<string,number>={...store.stock};
    store.ovens.forEach(j=>available[j.name]=(available[j.name]||0)+j.quantity);
    const out:Record<string,number>={};
    const findRecipe=(name:string)=>store.recipes.find(r=>r.name.toLowerCase()===name.toLowerCase());
    const consume=(name:string,quantity:number,depth=0)=>{let left=Math.ceil(quantity),have=available[name]||0,use=Math.min(left,have);available[name]=have-use;left-=use;if(!left)return;const sub=depth<7?findRecipe(name):undefined;if(sub){const batches=Math.ceil(left/Math.max(1,sub.output));sub.materials.forEach(m=>consume(m.name,Math.ceil(m.quantity*batches*multiplier),depth+1))}else out[name]=(out[name]||0)+left};
    store.projects.forEach(p=>{const r=store.recipes.find(x=>x.id===p.recipeId),left=Math.max(0,p.quantity-p.completed);if(r)r.materials.forEach(m=>consume(m.name,m.quantity*left*multiplier))});
    return out;
  },[store.stock,store.ovens,store.projects,store.recipes,multiplier]);
  const missingValue=Object.entries(expandedMissing).reduce((sum,[name,qty])=>sum+qty*(store.prices[name]||0),0);

  function log(text: string, next: Store): Store {
    return { ...next, history: [{ id: uid(), text, at: new Date().toISOString() }, ...next.history].slice(0, 100) };
  }
  function addStock(e: React.FormEvent) {
    e.preventDefault(); const name = stockName.trim(); const qty = Number(stockQty);
    if (!name || !Number.isFinite(qty)) return;
    setStore(s => log(`Added ${fmt(qty)} ${name}`, { ...s, stock: { ...s.stock, [name]: (s.stock[name] || 0) + qty } }));
    setStockName(""); setStockQty("");
  }
  function importInventory(items: Array<{name:string;quantity:number}>, mode: "add"|"replace") {
    setStore(s => {
      const stock = { ...s.stock };
      items.forEach(item => stock[item.name] = mode === "add" ? (stock[item.name] || 0) + item.quantity : item.quantity);
      return log(`Imported ${items.length} item stacks from screenshot`, { ...s, stock });
    });
  }
  function importOvens(jobs: Array<{name:string;quantity:number;remaining:string;character:number}>) {
    setStore(s => log(`Imported ${jobs.length} active capital-part oven jobs`, { ...s, ovens: jobs.map(j => ({ ...j, id: uid() })) }));
  }
  function addProject(e: React.FormEvent) {
    e.preventDefault(); if (!selectedRecipe || buildQty < 1) return;
    const recipe = store.recipes.find(r => r.id === selectedRecipe)!;
    setStore(s => log(`Queued ${buildQty} × ${recipe.name}`, { ...s, projects: [...s.projects, { id: uid(), recipeId: selectedRecipe, quantity: buildQty, completed: 0, created: new Date().toISOString() }] }));
  }
  function completeOne(p: Project) {
    const r = store.recipes.find(x => x.id === p.recipeId); if (!r || p.completed >= p.quantity) return;
    const needed = r.materials.map(m => ({ ...m, quantity: Math.ceil(m.quantity * multiplier) }));
    const short = needed.find(m => (store.stock[m.name] || 0) < m.quantity);
    if (short) { alert(`Not enough ${short.name}. You need ${fmt(short.quantity)}.`); return; }
    setStore(s => {
      const stock = { ...s.stock };
      needed.forEach(m => stock[m.name] = (stock[m.name] || 0) - m.quantity);
      stock[r.name] = (stock[r.name] || 0) + r.output;
      return log(`Completed 1 × ${r.name}; materials deducted`, { ...s, stock, projects: s.projects.map(x => x.id === p.id ? { ...x, completed: x.completed + 1 } : x) });
    });
  }
  function addRecipe(e: React.FormEvent) {
    e.preventDefault(); const mats = recipeMaterials.filter(m => m.name.trim() && m.quantity > 0);
    if (!recipeName.trim() || !mats.length) return;
    setStore(s => log(`Created recipe: ${recipeName.trim()}`, { ...s, recipes: [...s.recipes, { id: uid(), name: recipeName.trim(), category: recipeCategory, output: 1, materials: mats }] }));
    setRecipeName(""); setRecipeMaterials([{ name: "", quantity: 0 }]);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `echoes-foundry-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { setStore(JSON.parse(String(reader.result))); } catch { alert("That backup file could not be read."); } }; reader.readAsText(file);
  }
  if (!ready) return null;
  return <div className="shell">
    <aside>
      <div className="brand"><span className="mark">EF</span><div><b>Echoes Foundry</b><small>INDUSTRY COMMAND</small></div></div>
      <nav>{[["dashboard","Overview"],["inventory","Inventory"],["needs","Build needs"],["projects","Builder"],["settings","Settings"]].map(([id,label]) => <button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      <div className="sync"><i></i><div><b>Shared crew</b><small>{sharedState}</small></div></div>
    </aside>
    <main>
      <header><div><small>NEW EDEN INDUSTRY</small><h1>{tab === "dashboard" ? "Manufacturing overview" : tab === "projects" ? "Builder" : tab === "needs" ? "Build needs" : tab[0].toUpperCase()+tab.slice(1)}</h1>{tab === "projects" && <p className="statusline">{catalogState}</p>}</div><button className="ghost" onClick={exportData}>Export backup</button></header>

      {tab === "dashboard" && <>
        <section className="stats"><article><span>INVENTORY VALUE</span><strong>{inventoryValue?isk(inventoryValue):"—"}</strong><small>weekly market average</small></article><article><span>MATERIAL TYPES</span><strong>{Object.keys(store.stock).length}</strong><small>in your inventory</small></article><article><span>BUILD PROGRESS</span><strong>{progress}%</strong><div className="bar"><i style={{width:`${progress}%`}}></i></div></article><article className="warn"><span>SHORTAGE VALUE</span><strong>{shortageValue?isk(shortageValue):"—"}</strong><small>{missing.length} materials to acquire</small></article></section>
        <div className="grid2"><section className="panel"><div className="panelhead"><h2>Active projects</h2><button onClick={()=>setTab("projects")}>View queue</button></div>{store.projects.filter(p=>p.completed<p.quantity).slice(0,5).map(p => {const r=store.recipes.find(x=>x.id===p.recipeId); return <div className="project" key={p.id}><div className="cube">◆</div><div><b>{r?.name}</b><small>{p.completed} of {p.quantity} completed</small></div><span>{Math.round(p.completed/p.quantity*100)}%</span></div>})}{!store.projects.length&&<div className="empty">No builds queued yet.</div>}</section>
        <section className="panel"><div className="panelhead"><h2>Material shortages</h2><button onClick={()=>setTab("needs")}>Build needs</button></div>{Object.entries(expandedMissing).slice(0,6).map(([name,qty])=><div className="material" key={name}><div><b>{name}</b><small>{piNames.has(name)?"Planetary material":"Mineral / component"}</small></div><strong>{fmt(qty)}</strong></div>)}{!Object.keys(expandedMissing).length&&<div className="empty">Everything required is covered.</div>}</section></div>
        <section className="panel wide" style={{marginTop:18}}><div className="panelhead"><h2>Recent activity</h2><small>{sharedState}</small></div>{store.history.slice(0,8).map(h=><div className="history" key={h.id}><i></i><div><b>{h.text}</b><small>{new Date(h.at).toLocaleString("en-GB")}</small></div></div>)}{!store.history.length&&<div className="empty">Inventory imports and completed builds will appear here.</div>}</section>
      </>}
      {tab === "inventory" && <InventoryImporter onImport={importInventory}/>} 

      {tab === "inventory" && <><div className="inventorySummary"><div><span className="mfgLabel">Inventory · Item hangar</span><h2>{Object.keys(store.stock).length} item types</h2></div><strong>{inventoryValue?isk(inventoryValue):"Value loading…"}</strong></div><form className="inline" onSubmit={addStock}><input placeholder="Material or component" value={stockName} onChange={e=>setStockName(e.target.value)}/><input type="number" placeholder="Quantity" value={stockQty} onChange={e=>setStockQty(e.target.value)}/><button>Add to inventory</button></form><div className="inventoryList">{Object.entries(store.stock).sort().map(([name,qty])=><article className="inventoryItem" key={name}><b title={name}>{name}</b>{itemIcons[name]?<img src={itemIcons[name]} alt=""/>:<div className="fallbackIcon">◇</div>}<strong>{fmt(qty)}</strong><small>{store.prices[name]?isk(qty*store.prices[name]):"No price"}</small></article>)}</div>{!Object.keys(store.stock).length&&<div className="empty">Your inventory is empty. Import screenshots or add an item above.</div>}</>}

      {tab === "needs" && <><div className="needsHero"><article><span>MISSING MATERIAL TYPES</span><strong>{Object.keys(expandedMissing).length}</strong></article><article><span>ESTIMATED PURCHASE VALUE</span><strong>{missingValue?isk(missingValue):"—"}</strong></article><article><span>PI ITEMS MISSING</span><strong>{Object.keys(expandedMissing).filter(n=>piNames.has(n)).length}</strong></article></div><section className="panel wide"><div className="panelhead"><div><h2>Build material shortages</h2><p>Capital parts are expanded into underlying materials. Inventory and active ovens are already deducted.</p></div></div><div className="needsTable"><div className="needsRow head"><span>Material</span><span>Missing</span><span>Unit value</span><span>Estimated value</span></div>{Object.entries(expandedMissing).sort((a,b)=>(piNames.has(b[0])?1:0)-(piNames.has(a[0])?1:0)||a[0].localeCompare(b[0])).map(([name,qty])=><div className="needsRow" key={name}><b>{name}<small>{piNames.has(name)?"PLANETARY MATERIAL":"MINERAL / COMPONENT"}</small></b><strong className="missing">{fmt(qty)}</strong><span>{store.prices[name]?isk(store.prices[name]):"—"}</span><strong className="value">{store.prices[name]?isk(qty*store.prices[name]):"—"}</strong></div>)}</div>{!Object.keys(expandedMissing).length&&<div className="empty">Queue a build, or everything required is already covered.</div>}</section></>}

      {tab === "projects" && <><form className="manufacture" onSubmit={addProject}><div className="mfgTop"><h2>▰ MANUFACTURE</h2><span>Manufacturing jobs {store.ovens.length + store.projects.filter(p=>p.completed<p.quantity).length}/40</span></div><div className="mfgGrid"><div className="mfgSide"><span className="mfgLabel">Manufacturing facility</span><div className="mfgBox"><small>Personal industry network</small><b>Echoes Foundry · 4 characters</b></div><span className="mfgLabel">Blueprint</span><div className="mfgBox"><select value={selectedRecipe} onChange={e=>setSelectedRecipe(e.target.value)}><option value="">Select blueprint…</option>{store.recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><div className="blueprintTile">{selectedBuild?"◇":"?"}</div><small>{selectedBuild?.category||"Choose a blueprint"}</small></div></div><div className="mfgCenter"><div className="productCore">{selectedBuild?"◆":"+"}</div><div className="mfgProduct"><small>PRODUCT</small><h3>{selectedBuild?.name||"Select a blueprint"}</h3><span>{selectedBuild?`Output: ${selectedBuild.output*buildQty}`:"Your manufacturing plan appears here"}</span></div><div className="qtyControl"><button type="button" onClick={()=>setBuildQty(Math.max(1,buildQty-1))}>−</button><input type="number" min="1" value={buildQty} onChange={e=>setBuildQty(Math.max(1,Number(e.target.value)))}/><button type="button" onClick={()=>setBuildQty(buildQty+1)}>+</button></div><button className="startJob" disabled={!selectedBuild}>Add to build queue</button></div><div className="mfgSide right"><div className="efficiency"><span>Material efficiency</span><strong>{Math.round(multiplier*100)}%</strong></div><span className="mfgLabel">Required materials</span><div className="mfgMats">{selectedBuild?.materials.map(m=>{const need=Math.ceil(m.quantity*buildQty*multiplier),have=store.stock[m.name]||0;return <div className="mfgMat" key={m.name}><div><b>{m.name}</b><small>Have {fmt(have)}</small></div><strong className={have>=need?"ready":"short"}>{fmt(have)}/{fmt(need)}</strong></div>})}{!selectedBuild&&<div className="empty">Select a blueprint to generate the material list.</div>}</div></div></div></form><div className="loadEstimate panel wide"><div><small>RORQUAL LOAD ESTIMATE</small><b>{automaticLoadValue&&shortageValue?Math.ceil(shortageValue/automaticLoadValue)+" loads":"Waiting for queued build and prices"}</b></div><span>2.5× saved mix · 5/5/5 reprocess · sold at 90% Jita</span></div><OvenImporter onImport={importOvens}/>{store.ovens.length>0&&<section className="panel wide"><div className="panelhead"><div><h2>Capital parts currently in ovens</h2><p>{store.ovens.reduce((n,j)=>n+j.quantity,0)} parts across {store.ovens.length} active slots and {new Set(store.ovens.map(j=>j.character)).size} characters.</p></div><button className="ghost" onClick={()=>setStore(s=>({...s,ovens:[]}))}>Clear snapshot</button></div>{store.ovens.map(j=><div className="material" key={j.id}><div><b>{j.quantity} × {j.name}</b><small>Character {j.character} · {j.remaining} remaining</small></div></div>)}</section>}<section className="cards">{store.projects.map(p=>{const r=store.recipes.find(x=>x.id===p.recipeId);return <article className="buildcard" key={p.id}><div><small>{r?.category}</small><h3>{r?.name}</h3></div><strong>{p.completed}/{p.quantity}</strong><div className="bar"><i style={{width:`${p.completed/p.quantity*100}%`}}></i></div><button disabled={p.completed>=p.quantity} onClick={()=>completeOne(p)}>{p.completed>=p.quantity?"Build complete":"Complete one build"}</button><button className="danger" onClick={()=>setStore(s=>({...s,projects:s.projects.filter(x=>x.id!==p.id)}))}>Remove</button></article>})}</section></>}

      {tab === "recipes" && <div className="grid2 recipes"><section className="panel"><h2>Blueprint catalogue</h2><input className="search" placeholder="Search blueprints…" value={query} onChange={e=>setQuery(e.target.value)}/>{filteredRecipes.map(r=><details key={r.id}><summary><div><b>{r.name}</b><small>{r.category}</small></div><span>{r.materials.length} materials</span></summary>{r.materials.map(m=><div className="recipeMat" key={m.name}><span>{m.name}</span><b>{fmt(Math.ceil(m.quantity*multiplier))}</b></div>)}</details>)}</section><section className="panel"><h2>Add a custom blueprint</h2><p>Enter the quantities shown in game at the base recipe level.</p><form className="stack" onSubmit={addRecipe}><input placeholder="Blueprint / output name" value={recipeName} onChange={e=>setRecipeName(e.target.value)}/><select value={recipeCategory} onChange={e=>setRecipeCategory(e.target.value)}>{["Ship","Structure","Module","Drone","Commodity","Structure Module"].map(x=><option key={x}>{x}</option>)}</select>{recipeMaterials.map((m,i)=><div className="matrow" key={i}><input placeholder="Material" value={m.name} onChange={e=>setRecipeMaterials(a=>a.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><input type="number" placeholder="Qty" value={m.quantity||""} onChange={e=>setRecipeMaterials(a=>a.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x))}/></div>)}<button type="button" className="ghost" onClick={()=>setRecipeMaterials(a=>[...a,{name:"",quantity:0}])}>+ Add material</button><button>Save blueprint</button></form></section></div>}

      {tab === "history" && <section className="panel wide"><h2>Activity log</h2>{store.history.map(h=><div className="history" key={h.id}><i></i><div><b>{h.text}</b><small>{new Date(h.at).toLocaleString("en-GB")}</small></div></div>)}{!store.history.length&&<div className="empty">Completed builds and inventory changes appear here.</div>}</section>}

      {tab === "settings" && <div className="settingswrap"><section className="panel settings cloudpanel"><h2>Shared crew</h2><p>Everyone using this site shares one automatic save. No accounts, codes, or save buttons.</p><p className="statusline">{sharedState}</p></section><section className="panel settings"><h2>Manufacturing settings</h2><label>Industry skill multiplier<select value={store.settings.skill} onChange={e=>setStore(s=>({...s,settings:{...s.settings,skill:Number(e.target.value)}}))}><option value="1.5">0/0/0 — 150%</option><option value="1.2">5/0/0 — 120%</option><option value="1.04">5/4/0 — 104%</option><option value="0.97">5/5/3 — 97%</option><option value="0.96">5/5/4 — 96%</option><option value="0.95">5/5/5 — 95%</option></select></label><label>Citadel bonus<select value={store.settings.citadel} onChange={e=>setStore(s=>({...s,settings:{...s.settings,citadel:Number(e.target.value)}}))}><option value="0">No bonus</option><option value="0.01">1%</option></select></label><label>Decryptor bonus<select value={store.settings.decryptor} onChange={e=>setStore(s=>({...s,settings:{...s.settings,decryptor:Number(e.target.value)}}))}><option value="0">None</option><option value="0.02">Symmetry — 2%</option><option value="0.05">Process — 5%</option></select></label><label>Builder fee<select value={store.settings.builder} onChange={e=>setStore(s=>({...s,settings:{...s.settings,builder:Number(e.target.value)}}))}><option value="0">No fee</option><option value="0.1">Small — 10%</option><option value="0.2">Regular — 20%</option><option value="0.3">Big — 30%</option></select></label><div className="backup"><button onClick={exportData}>Export backup</button><button className="ghost" onClick={()=>importRef.current?.click()}>Import backup</button><input ref={importRef} hidden type="file" accept="application/json" onChange={importData}/></div></section></div>}
    </main>
  </div>;
}
