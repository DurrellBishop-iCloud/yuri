# Filespace — Conceptual Model (working draft)

A visual alternative to the folder metaphor. This page captures the model we've
worked out in conversation, so it can be pressure-tested before any code.

---

## 1. One primitive: the Object

There is only one kind of thing — an **object**. A car, a room, a chair, a dial,
a radio station, a colour, a person, a folder: all objects. There is no separate
"file", "folder", "group", or "icon" type. Those are *roles* an object plays, not
what it is.

## 2. One relationship: belonging

Objects relate to other objects by **belonging**. This single relationship covers
what we'd normally split into grouping, containment, ownership, placement,
classification, and properties — they differ only in *kind* and *strength*, not
in nature.

A belonging links a **member** object to a **context** object and carries:

- **kind** — spatial · ownership · situational · lineage · property · …
- **placement** — `{ x, y, size }` *within that context's space* (when shown)
- **strength** — loose & transient (at this table now) · firm (owned by the café)
  · definitional (it *is* an Eames)
- **role / label** — its contextual name ("the dial", "the third element")

## 3. Object ↔ Context is a point of view

Nothing is intrinsically a container. An object is a **context** seen from inside
(its members become the objects) and an **object** seen from outside (it reads as
a whole). The café is an object; step in and it is a context. "Container vs
content" is decided by *where you stand* — never stored.

- No privileged root — you can always go further out or further in. Open both ways.
- Your **current context is the coordinate origin**, so the maths stays local and
  small → genuinely infinite zoom.

## 4. The object is the only invariant

Everything contextual lives on the **belonging**, not the object:

- **Position and size are per-belonging.** The chair is *there* on the café floor,
  *among its siblings* in "Eames Aluminium Group", *somewhere* in "the café's
  property". It has as many positions as it has belongings.
- **Multiple parents** (tag-like) — an object can belong to many contexts at once.
  Whether it *may* is a property (1 = exclusive, many = shareable).
- **Per-context appearance** comes free — large in one context, a dot in another.
- One hard rule: **no cycles** (A can't contain B while B contains A).
- Dragging out removes *that* belonging; the object survives through its others.

## 5. Properties are belongings too — and gateways to other contexts

"What is this chair made of?" → *walnut*. "Made of walnut" is at once a **property**
of the chair and a **belonging** in the context *walnut things*. And **walnut** is
itself an object (with its own colour, grain, density), so a property is a doorway:
follow it and you arrive in another context.

Comparisons — "is that darker than mahogany?" — mean some contexts are
**ordered / measured spaces**, not just sets. So a context's landscape can be:

- a **free space** — café floor: arrange anywhere;
- a **set** — walnut things: membership, no inherent order;
- an **axis / measure** — sort by darkness, by date, by size.

Stepping out *through a property* is a primary way to see alternative contexts.

## 6. How an object shows itself: apparent size

One rule drives all rendering: an object's **representation is a function of its
apparent size** ( = camera zoom × ancestor scales × its own placement size ).

- large → its **form** — a recognisable boundary (fence) around its expressed members
- smaller → an **icon** — the form simplified to a silhouette
- tiny → a **label** — a word — or it disappears

Therefore:

- **A fence is the boundary of a context's members** — its shape is a readout of
  what is inside and how it is arranged.
- **Zoom (viewing) and resizing an object (authoring) are the same axis.** Make a
  thing bigger and it *opens earlier*. **Size = prominence.**
- Bands cross-fade, so forms melt into icons rather than popping.

## 7. Empty, and the bottom

- **Empty is fine.** An object can exist with nothing expressed yet — a real
  thing or idea (a car, a room, a sheet of paper) whose components simply are not
  drawn yet.
- **The bottom of zoom is not always more objects.** Radio 4 is not decomposed
  into sub-objects; it is *tuned, and it plays sound*. So a leaf is either an idea
  not yet expressed, or an object whose inside is a medium / value / behaviour
  rather than more objects.

## 8. Reflecting context (the view)

You are always **inside one context**, laid out as a landscape with fences. To
reflect that an object lives in many contexts:

- **Switch lens** *(primary motion)* — re-group the same objects by another
  belonging (by owner, by designer, by table). The world re-fences and re-positions.
- **Reveal on demand** — select an object and light up every other context it
  belongs to ("show me everywhere this lives").
- **Overlay** *(special case)* — ghosted, overlapping fences when two contexts
  genuinely share a space.

Proposed default: **switch lens + reveal on demand**; overlay only where contexts
truly share space.

---

## Still open

- Is *shareable* a property of the object, or something a context grants?
- Is strength of belonging a few discrete kinds, or a continuum?
- Do definitional facts ("is an Eames") count as belongings, or as identity?
- Which lens behaviour leads — switch, reveal, or overlay?
- Where exactly does a leaf turn from "objects inside" to "content / behaviour"?

---

## What this means for the build

- **Data:** `Object` (identity only) + `Belonging` (member → context, with kind,
  placement, strength, role). The belonging graph is the whole structure;
  acyclic; multi-parent allowed.
- **Render:** canvas, immediate-mode, redraw per frame; walk belongings from the
  current context; pick representation by apparent size; cull sub-pixel and
  off-screen; cross-fade bands.
- **Coords:** local & relative to the current context → infinite, crisp.
- **Interact:** pan/pinch/zoom the camera; draw a fence to make a context and
  gather members; resize an object (edits its placement size); drag out to leave;
  follow a property to switch context.
