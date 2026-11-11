<script lang="ts">
  import type { PageData } from './$types';
  import {
    ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CircleHelp,
    ClipboardList, FileText, HeartHandshake, Leaf, MapPinned,
    MessageCircle, ShieldCheck, Smartphone, Truck, Users, Workflow
  } from '@lucide/svelte';

  let { data }: { data: PageData } = $props();
  let search = $state('');
  const roles = $derived(data.guideDirectory.filter(item =>
    !search.trim() || [item.title, item.description, item.audience].join(' ').toLowerCase()
      .includes(search.trim().toLowerCase())
  ));
  const totalSections = $derived(data.guide.sections.length);
  const iconFor = (id: string) => ({
    overview: BookOpen,
    administrators: ShieldCheck,
    dispatchers: MapPinned,
    rescuers: Smartphone,
    carers: HeartHandshake,
    transporters: Truck,
    communications: MessageCircle,
    records: ClipboardList,
    readiness: CheckCircle2
  })[id] ?? FileText;
</script>

<svelte:head>
  <title>{data.guide.title} · Rescue Hub Documentation</title>
  <meta name="description" content={data.guide.description} />
</svelte:head>

<div class="docs-root">
  <header class="global-header">
    <a class="identity" href="/documentation" aria-label="Rescue Hub documentation home">
      <span class="brand-symbol" aria-hidden="true"><Leaf size={19} strokeWidth={2.5}/></span>
      <span><strong>RESCUE HUB</strong><small>Documentation centre</small></span>
    </a>
    <nav aria-label="Site">
      <a href="/documentation">Documentation</a>
      {#if data.isAdministrator}<a href="/admin">Administration</a>
      {:else if data.isStaff}<a href="/">Rescue dashboard</a>{/if}
      {#if !data.isStaff}<a class="header-action" href="/login">Staff sign in <ArrowRight size={15}/></a>
      {:else}<span class="signed-in">{data.userName}</span>{/if}
    </nav>
  </header>

  <div class="docs-layout">
    <aside class="sidebar" aria-label="Documentation sections">
      <div class="sidebar-inner">
        <label class="sidebar-label" for="guide-filter">GUIDE LIBRARY</label>
        <div class="search-wrap">
          <CircleHelp size={17} aria-hidden="true"/>
          <input id="guide-filter" placeholder="Find a guide" bind:value={search} autocomplete="off"/>
        </div>
        <nav class="guide-nav" aria-label="Guides">
          {#each roles as item (item.id)}
            <a class:current={item.id === data.guide.id}
              href="/documentation?guide={item.id}" aria-current={item.id === data.guide.id ? 'page' : undefined}>
              {@const GuideIcon = iconFor(item.id)}
              <GuideIcon size={18} strokeWidth={1.8} aria-hidden="true"/>
              <span>{item.title}</span>
              {#if item.id === data.guide.id}<span class="current-marker" aria-hidden="true"></span>{/if}
            </a>
          {:else}
            <p class="no-results">No matching guides</p>
          {/each}
        </nav>
        {#if !data.isStaff}
          <div class="staff-notice">
            <ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true"/>
            <strong>Staff training guides</strong>
            <p>Administrators, dispatchers, rescuers and carers can sign in to view their operating guides.</p>
            <a href="/login?next=/documentation">Staff sign in <ArrowRight size={15}/></a>
          </div>
        {/if}
        <div class="side-footer">
          <p>NSW demonstration · November 2026</p>
          <p>Independent prototype, not a government service.</p>
        </div>
      </div>
    </aside>

    <main id="main-content">
      <div class="content-wrap">
        <div class="breadcrumb">
          <a href="/documentation">Documentation</a>
          <span aria-hidden="true">/</span>
          <span>{data.guide.title}</span>
        </div>
        {#if data.guide.id === 'overview'}
          <div class="hero hero-overview">
            <p class="eyebrow">A CONNECTED WILDLIFE RESCUE PLATFORM</p>
            <h1>From the first report to the final release.</h1>
            <p class="hero-description">Rescue Hub brings public wildlife reports, dispatch, volunteer response, transport, veterinary updates, rehabilitation and historical records into one connected workflow.</p>
            <div class="hero-actions">
              <a class="primary-cta" href="#how-it-works">Explore the workflow <ArrowRight size={17}/></a>
              <a class="secondary-cta" href="/documentation?guide=readiness">Current project status</a>
            </div>
            <div class="hero-foot"><span class="dot"></span> Built for wildlife organisations and authorised oversight</div>
          </div>
          <div class="value-grid">
            <div><MapPinned size={25} strokeWidth={1.7}/><strong>Location-based response</strong><p>Connect reports to the responsible operating area.</p></div>
            <div><Users size={25} strokeWidth={1.7}/><strong>Volunteer self-claim</strong><p>Rescuers and transporters choose the work they can do.</p></div>
            <div><HeartHandshake size={25} strokeWidth={1.7}/><strong>Continuous animal care</strong><p>One record through pickup, veterinary care and release.</p></div>
          </div>
        {:else}
          <div class="guide-hero">
            <p class="eyebrow">RESCUE HUB · ROLE-BASED GUIDES</p>
            <div class="guide-icon"><svelte:component this={iconFor(data.guide.id)} size={25} strokeWidth={1.8}/></div>
            <h1>{data.guide.title}</h1>
            <p class="hero-description">{data.guide.description}</p>
            <div class="guide-metadata"><span>{data.guide.audience}</span><span>·</span><span>Approx. {data.guide.minutes} min read</span><span>·</span><span>{totalSections} sections</span></div>
          </div>
        {/if}

        <div class="body-grid">
          <article class="article" aria-label={data.guide.title}>
            {#each data.guide.sections as section, index (section.id)}
              <section id={data.guide.id === 'overview' && index === 0 ? 'how-it-works' : section.id}>
                <div class="section-label">SECTION {String(index + 1).padStart(2, '0')}</div>
                <h2>{section.title}</h2>
                {#if section.intro}<p class="section-intro">{section.intro}</p>{/if}
                {#if section.points}
                  <ul class="point-list">
                    {#each section.points as point}
                      <li><CheckCircle2 size={17} strokeWidth={1.9} aria-hidden="true"/><span>{point}</span></li>
                    {/each}
                  </ul>
                {/if}
                {#if section.steps}
                  <ol class="steps">
                    {#each section.steps as step, stepIndex}
                      <li>
                        <span class="step-number">{String(stepIndex + 1).padStart(2, '0')}</span>
                        <div><strong>{step.title}</strong><p>{step.detail}</p></div>
                      </li>
                    {/each}
                  </ol>
                {/if}
                {#if section.note}<div class="note"><ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true"/><p>{section.note}</p></div>{/if}
              </section>
            {/each}

            <div class="article-bottom">
              <div><strong>Continue exploring Rescue Hub</strong><p>Choose the next guide for your role or share this overview with a colleague.</p></div>
              <a class="continue" href="/documentation?guide={data.guide.id === 'overview' ? 'readiness' : 'overview'}">
                {data.guide.id === 'overview' ? 'View project status' : 'Back to overview'} <ArrowRight size={17}/>
              </a>
            </div>
          </article>

          <aside class="toc" aria-label="On this page">
            <div class="toc-sticky">
              <p class="toc-label">ON THIS PAGE</p>
              {#each data.guide.sections as section, index (section.id)}
                <a href="#{data.guide.id === 'overview' && index === 0 ? 'how-it-works' : section.id}">{section.title}</a>
              {/each}
              <div class="toc-card">
                <Workflow size={22} strokeWidth={1.7} aria-hidden="true"/>
                <strong>One animal. One history.</strong>
                <p>Rescue and transport jobs appear on the map. The animal record remains through every stage of care.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  </div>
  <footer class="site-footer"><span>© Rescue Hub · Independent wildlife rescue coordination prototype</span><a href="/documentation">Documentation home</a></footer>
</div>

<style>
  :global(html){scroll-behavior:smooth}
  :global(body){margin:0;background:#fafbf9}
  .docs-root{--forest:#173d2c;--ink:#1b2e23;--muted:#617369;--border:#dfe7e0;--surface:#fff;min-height:100vh;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  a{color:inherit;text-decoration:none}
  .global-header{height:76px;padding:0 clamp(20px,3vw,48px);display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:#fff;position:sticky;top:0;z-index:15}
  .identity{display:flex;align-items:center;gap:11px}
  .brand-symbol{height:39px;width:39px;display:grid;place-items:center;border-radius:11px;background:var(--forest);color:#fff}
  .identity>span:last-child{display:grid;gap:2px}
  .identity strong{letter-spacing:.15em;font-size:13px;color:var(--forest)}
  .identity small{font-size:12px;color:var(--muted)}
  .global-header nav{display:flex;align-items:center;gap:28px;font-size:13px;font-weight:650;color:#445e4e}
  .global-header nav a:hover{color:#057b4a}
  .header-action{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;background:var(--forest);color:#fff!important;border-radius:8px}
  .signed-in{font-size:12px;color:#68786e}
  .docs-layout{display:grid;grid-template-columns:265px minmax(0,1fr);max-width:1600px;margin:auto}
  .sidebar{border-right:1px solid var(--border);background:#f5f8f4}
  .sidebar-inner{position:sticky;top:76px;max-height:calc(100vh - 76px);overflow-y:auto;padding:32px 16px 26px;display:flex;flex-direction:column;gap:12px}
  .sidebar-label,.toc-label,.eyebrow,.section-label{font-size:11px;font-weight:800;letter-spacing:.14em;color:#5c7969}
  .sidebar-label{padding-left:13px}
  .search-wrap{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:10px;padding:0 12px;margin:2px 4px 10px;color:#82938a}
  input{min-width:0;width:100%;border:0;outline-offset:3px;background:transparent;padding:12px 2px;font:inherit;font-size:13px;color:var(--ink)}
  .guide-nav{display:grid;gap:3px}
  .guide-nav a{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:9px;font-size:13px;font-weight:650;color:#4b6655;position:relative}
  .guide-nav a:hover{background:#e6f0e8}
  .guide-nav a.current{background:#dcece0;color:#17593a}
  .guide-nav a>span:nth-child(2){flex:1}
  .current-marker{height:6px;width:6px;border-radius:50%;background:#25764d}
  .no-results{padding:12px;font-size:13px;color:var(--muted)}
  .staff-notice{margin:24px 4px 0;background:#fff;border:1px solid var(--border);border-radius:13px;padding:18px;color:#23543b;display:grid;gap:9px}
  .staff-notice strong{font-size:14px}
  .staff-notice p,.side-footer p{font-size:12px;line-height:1.55;color:var(--muted);margin:0}
  .staff-notice a{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:750}
  .side-footer{padding:20px 10px 0;display:grid;gap:4px}
  main{min-width:0;background:#fff}
  .content-wrap{max-width:1240px;margin:auto;padding:30px clamp(24px,4vw,65px) 100px}
  .breadcrumb{display:flex;align-items:center;gap:10px;color:#6d8576;font-size:12px;margin-bottom:27px}
  .breadcrumb a:hover{text-decoration:underline}
  .hero{border-radius:19px;overflow:hidden;padding:clamp(30px,5vw,65px);color:#fff;position:relative}
  .hero-overview{background:radial-gradient(circle at 100% 0%,rgba(160,214,166,.18),transparent 40%),linear-gradient(125deg,#133724,#1b5037)}
  .hero .eyebrow{color:#b5d7bf}
  .hero h1,.guide-hero h1{font-size:clamp(32px,4.25vw,56px);letter-spacing:-.055em;line-height:1.08;margin:20px 0}
  .hero h1{max-width:680px}
  .hero-description{font-size:clamp(16px,1.3vw,18px);line-height:1.65;max-width:750px}
  .hero .hero-description{color:#d4e9d9}
  .hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}
  .hero-actions a{padding:13px 18px;border-radius:9px;font-size:13px;font-weight:750;display:inline-flex;align-items:center;gap:8px}
  .primary-cta{background:#d2edb9;color:#19442c}
  .secondary-cta{border:1px solid #80aa8b;color:#fff}
  .hero-foot{display:flex;align-items:center;gap:8px;font-size:12px;margin-top:45px;color:#b0cdb8}
  .dot{height:7px;width:7px;border-radius:50%;background:#aad68d}
  .value-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin:23px 0 45px}
  .value-grid>div{background:#f5f9f5;border:1px solid #e1e9e1;border-radius:13px;padding:22px;display:grid;gap:8px;color:#1c6543}
  .value-grid strong{font-size:14px;color:#243e2c}.value-grid p{font-size:12px;line-height:1.6;color:#5e7365;margin:0}
  .guide-hero{padding:25px 0 35px;border-bottom:1px solid var(--border);margin-bottom:38px}
  .guide-hero h1{margin:14px 0 16px}
  .guide-icon{height:56px;width:56px;display:grid;place-items:center;border-radius:14px;background:#e6f3e9;color:#256b48;margin-top:21px}
  .guide-hero .hero-description{color:#5a7062;margin:0}
  .guide-metadata{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:23px;color:#678172;font-size:12px;font-weight:650}
  .body-grid{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:clamp(25px,4vw,62px)}
  .article{min-width:0}
  .article section{scroll-margin-top:110px;padding:0 0 40px;margin-bottom:42px;border-bottom:1px solid var(--border)}
  .article section:last-of-type{border:0}
  .section-label{color:#719781}
  h2{font-size:clamp(23px,2.4vw,30px);line-height:1.22;letter-spacing:-.035em;margin:11px 0 17px}
  .section-intro{font-size:15px;line-height:1.82;color:#4c6255;margin:0 0 23px}
  .point-list{padding:0;list-style:none;display:grid;gap:15px}
  .point-list li{display:flex;align-items:flex-start;gap:12px;line-height:1.7;color:#354c3d;font-size:14px}
  .point-list li :global(svg){flex:0 0 auto;color:#468562;margin-top:3px}
  .steps{padding:0;list-style:none;display:grid;gap:0}
  .steps li{display:grid;grid-template-columns:42px minmax(0,1fr);gap:13px;padding:18px 0;border-bottom:1px solid #eaf0ea}
  .steps li:last-child{border:0}
  .step-number{height:36px;width:36px;border-radius:10px;background:#edf6ef;color:#2b6745;font-size:12px;font-weight:800;display:grid;place-items:center}
  .steps strong{font-size:15px;color:#253f2e}
  .steps p{font-size:14px;line-height:1.7;color:#566f5f;margin:6px 0 0}
  .note{background:#f2f7ef;border-left:3px solid #6b9b70;border-radius:0 10px 10px 0;display:flex;gap:13px;padding:16px;margin-top:24px;color:#39714b}
  .note p{margin:0;font-size:13px;line-height:1.7;color:#46684e}
  .note :global(svg){flex-shrink:0}
  .toc-sticky{position:sticky;top:115px;display:grid;gap:2px}
  .toc-label{padding-bottom:12px}
  .toc a{font-size:12px;color:#61776a;padding:8px 0;line-height:1.45}
  .toc a:hover{color:#1b6946}
  .toc-card{margin-top:24px;background:#eff6ef;border-radius:12px;padding:17px;display:grid;gap:10px;color:#286c48}
  .toc-card strong{font-size:13px;color:#254932}
  .toc-card p{font-size:12px;line-height:1.6;color:#56745e;margin:0}
  .article-bottom{display:flex;align-items:center;justify-content:space-between;gap:25px;background:#f4f8f3;border-radius:13px;padding:24px}
  .article-bottom strong{font-size:16px}
  .article-bottom p{font-size:12px;color:#667a6a;line-height:1.55}
  .continue{display:flex;align-items:center;gap:7px;white-space:nowrap;padding:11px 14px;background:#173d2c;color:white;border-radius:8px;font-size:12px;font-weight:750}
  .site-footer{max-width:1600px;margin:auto;border-top:1px solid var(--border);display:flex;justify-content:space-between;gap:15px;padding:25px 35px;font-size:12px;color:#6d8071}
  .site-footer a{font-weight:700}
  @media(max-width:1100px){.docs-layout{grid-template-columns:220px minmax(0,1fr)}.body-grid{grid-template-columns:1fr}.toc{display:none}.value-grid{grid-template-columns:1fr}}
  @media(max-width:730px){.global-header{height:auto;min-height:68px;padding:11px 16px}.global-header nav{gap:12px}.global-header nav>a:not(.header-action){display:none}.signed-in{display:none}.docs-layout{display:block}.sidebar{border:0;border-bottom:1px solid var(--border)}.sidebar-inner{position:static;padding:13px 16px;max-height:none}.sidebar-label,.search-wrap,.side-footer,.staff-notice{display:none}.guide-nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin}.guide-nav a{white-space:nowrap;padding:10px 12px;background:#fff;border:1px solid var(--border)}.current-marker{display:none}.content-wrap{padding:22px 16px 55px}.breadcrumb{margin-bottom:16px}.hero{border-radius:13px;padding:26px 22px}.hero-foot{margin-top:25px}.value-grid{gap:9px;margin-bottom:28px}.value-grid>div{padding:15px}.article-bottom{display:grid}.article section{padding-bottom:25px;margin-bottom:28px}.site-footer{padding:20px 16px;display:grid}}
</style>
