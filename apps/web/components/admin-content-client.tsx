"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { LandingContent } from "@/lib/landing";

const emptyFeature = { title: "", description: "" };
const emptyFaq = { question: "", answer: "" };

export function AdminContentClient() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<LandingContent>("/admin/content/landing")
      .then(setContent)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load landing content."));
  }, []);

  function field<K extends keyof LandingContent>(key: K, value: LandingContent[K]) {
    setContent((current) => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    setMessage("");
    try {
      const saved = await apiFetch<LandingContent>("/admin/content/landing", {
        method: "PUT",
        body: JSON.stringify(content),
      });
      setContent(saved);
      setMessage("Landing page content published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish landing content.");
    } finally {
      setSaving(false);
    }
  }

  if (!content) {
    return <div className="app-page"><div className="skeleton-card">Loading landing CMS…</div>{message && <div className="form-error">{message}</div>}</div>;
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Landing CMS</span>
          <h1>Public content</h1>
          <p>Edit product copy, SEO metadata, features and FAQs without changing frontend source code.</p>
        </div>
        <button className="button button-dark" type="button" onClick={save} disabled={saving}>{saving ? "Publishing…" : "Publish changes"}</button>
      </div>

      <section className="panel cms-section">
        <div className="panel-title"><div><span className="eyebrow">Brand & hero</span><h2>Primary messaging</h2></div></div>
        <div className="form-grid">
          <label className="field"><span>Brand name</span><input value={content.brandName} onChange={(e) => field("brandName", e.target.value)} /></label>
          <label className="field"><span>Announcement</span><input value={content.announcement} onChange={(e) => field("announcement", e.target.value)} /></label>
          <label className="field"><span>Eyebrow</span><input value={content.heroEyebrow} onChange={(e) => field("heroEyebrow", e.target.value)} /></label>
          <label className="field field-wide"><span>Hero title</span><input value={content.heroTitle} onChange={(e) => field("heroTitle", e.target.value)} /></label>
          <label className="field field-wide"><span>Hero description</span><textarea value={content.heroDescription} onChange={(e) => field("heroDescription", e.target.value)} /></label>
          <label className="field"><span>Primary CTA</span><input value={content.primaryCtaLabel} onChange={(e) => field("primaryCtaLabel", e.target.value)} /></label>
          <label className="field"><span>Secondary CTA</span><input value={content.secondaryCtaLabel} onChange={(e) => field("secondaryCtaLabel", e.target.value)} /></label>
        </div>
      </section>

      <section className="panel cms-section">
        <div className="panel-title">
          <div><span className="eyebrow">Feature blocks</span><h2>Product capabilities</h2></div>
          <button className="button button-light button-small" type="button" onClick={() => field("features", [...content.features, { ...emptyFeature }])}>+ Feature</button>
        </div>
        <div className="cms-list">
          {content.features.map((item, index) => (
            <div className="cms-row" key={index}>
              <input
                value={item.title}
                placeholder="Feature title"
                onChange={(e) => field("features", content.features.map((row, i) => i === index ? { ...row, title: e.target.value } : row))}
              />
              <textarea
                value={item.description}
                placeholder="Feature description"
                onChange={(e) => field("features", content.features.map((row, i) => i === index ? { ...row, description: e.target.value } : row))}
              />
              <button className="text-button danger-text" type="button" onClick={() => field("features", content.features.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel cms-section">
        <div className="panel-title">
          <div><span className="eyebrow">FAQ</span><h2>Questions and answers</h2></div>
          <button className="button button-light button-small" type="button" onClick={() => field("faq", [...content.faq, { ...emptyFaq }])}>+ FAQ</button>
        </div>
        <div className="cms-list">
          {content.faq.map((item, index) => (
            <div className="cms-row" key={index}>
              <input
                value={item.question}
                placeholder="Question"
                onChange={(e) => field("faq", content.faq.map((row, i) => i === index ? { ...row, question: e.target.value } : row))}
              />
              <textarea
                value={item.answer}
                placeholder="Answer"
                onChange={(e) => field("faq", content.faq.map((row, i) => i === index ? { ...row, answer: e.target.value } : row))}
              />
              <button className="text-button danger-text" type="button" onClick={() => field("faq", content.faq.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel cms-section">
        <div className="panel-title"><div><span className="eyebrow">Search</span><h2>SEO metadata</h2></div></div>
        <div className="form-grid">
          <label className="field field-wide"><span>SEO title</span><input value={content.seoTitle} onChange={(e) => field("seoTitle", e.target.value)} /></label>
          <label className="field field-wide"><span>SEO description</span><textarea value={content.seoDescription} onChange={(e) => field("seoDescription", e.target.value)} /></label>
          <label className="field field-wide"><span>Footer text</span><input value={content.footerText} onChange={(e) => field("footerText", e.target.value)} /></label>
        </div>
      </section>

      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
