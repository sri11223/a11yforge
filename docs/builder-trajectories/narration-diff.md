# What a screen-reader user actually hears — before vs after

Every line below is **captured output**, not prose: the [Guidepup](https://github.com/guidepup/guidepup)
virtual screen reader traverses the original DOM and then the agent's shipped DOM, and we diff the
two spoken-phrase logs. `-` is what the user heard **before** the fix, `+` what they hear **after**.

**Honest scope — read this before the diffs.** This is a *virtual* screen reader: a deterministic
simulation of reading order, operability and accessible-name presence. It is **not** a bug-for-bug
replica of NVDA, JAWS or VoiceOver, and it is **not a substitute for testing with real screen-reader
users**. Guidepup's own maintainers are explicit that automation complements rather than replaces
manual AT testing, and we hold the same posture: this shows that the *announced experience* changed,
not that a real user's task succeeded.

**How to read the counts.** Each capture is a **121-announcement window on 26 of 27 pages** — `aria-label-contradicts` terminates early at 21 (the
traversal is stepped a bounded number of times). On a long page that window is a truncated
single pass; on a short page the traversal reaches `end of document` and **wraps**, so the
window contains several passes and one real difference appears once per pass. We therefore
rank and report **distinct** changed announcements, not raw diff lines, and show the pass
count per page so the raw numbers can't mislead.

**What this artifact can and cannot show.** It surfaces changes to what is *announced* —
accessible names, reading order, headings, whether a filename gets read out. It does **not**
surface *operability* fixes: this is a reading-order traversal, which visits content whether
or not it is keyboard-reachable, so making a control focusable/activatable (adding `tabindex`
and key handlers, or letting Escape close a dialog) correctly produces **no announcement
change here**. Those fixes are evidenced by the Layer-B findings and the per-page
[trajectories](README.md) instead. That is why several of our most important keyboard repairs
appear below as "no audible change" — we show them rather than hide the inconvenient half.

**Division of evidence, so neither half carries the other's weight:** announcement diffs prove
the *name / reading-order / text* class; **finding-disappearance** proves the *operability*
class — e.g. `keyboard-trap-modal` is detected as "[2.1.2] focus is trapped: Tab does not move
focus out, Escape does not dismiss it" and ships Layer A 0 · B 0 · C 0, visible in its
[trajectory](keyboard-trap-modal.md). Each unchanged page below links its own trajectory.

**And note what this transcript is not:** it is *evidence*, not the detector. Every Layer-B
finding is produced by the deterministic check functions (heading outline, skip links, tab
order, visual order, live regions, dialog traps, control operability); nothing in the finding
path reads the announcement log. So the traversal window above can only affect this artifact —
it cannot move `metrics.json` or `ablation.json`, which reproduce byte-identically whether the
virtual SR engages or not.

Captured across **27 pages**: **16** produced an audible difference, **11** did not (all listed, with the reason).

## Most dramatic differences

- **css-reorder** — 21 distinct phrase(s) gone, 28 new · e.g. `heading, Enterprise, level 2` → `article`
- **alt-generic** — 3 distinct phrase(s) gone, 9 new · e.g. `image, photo` → `end of main`
- **alt-is-filename** — 3 distinct phrase(s) gone, 9 new · e.g. `image, DSC_0042.jpg` → `end of contentinfo`
- **placeholder-as-label** — 5 distinct phrase(s) gone, 5 new · e.g. `textbox, placeholder Full name` → `textbox, Full name, placeholder Full name`
- **inj-alt-filename-heading** — 2 distinct phrase(s) gone, 8 new · e.g. `image, IMG_5521.jpg` → `heading, Jordan Lee, level 2`

## Per page

### alt-generic

_adversarial · 2 traversal pass(es) in the window · **3 distinct phrase(s) removed, 9 added** (9/9 raw diff lines)_

```diff
 document
 banner
 link, Atlas Studio
 navigation, Primary
 link, Work
 link, Studio
 link, Contact
 end of navigation, Primary
 end of banner
 main
 heading, Selected work, level 1
 paragraph
 Brand systems and campaigns for people who make things.
 end of paragraph
 image, image
 region, Projects
 figure
-image, photo
 caption
 Harvest Table — identity
 end of caption
 end of figure
 figure
-image, image
 caption
 Lumen — packaging
 end of caption
 end of figure
 figure
-image, picture
 caption
 Verge — campaign
 end of caption
 end of figure
 end of region, Projects
 end of main
 contentinfo
 paragraph
 © Atlas Studio.
 link, Instagram
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Atlas Studio
 navigation, Primary
 link, Work
 link, Studio
 link, Contact
 end of navigation, Primary
 end of banner
 main
 heading, Selected work, level 1
 paragraph
 Brand systems and campaigns for people who make things.
 end of paragraph
 image, image
 region, Projects
 figure
-image, photo
 caption
 Harvest Table — identity
 end of caption
 end of figure
 figure
-image, image
 caption
 Lumen — packaging
 end of caption
 end of figure
 figure
-image, picture
 caption
 Verge — campaign
 end of caption
 end of figure
 end of region, Projects
 end of main
 contentinfo
 paragraph
 © Atlas Studio.
 link, Instagram
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Atlas Studio
 navigation, Primary
 link, Work
 link, Studio
 link, Contact
 end of navigation, Primary
 end of banner
 main
 heading, Selected work, level 1
 paragraph
 Brand systems and campaigns for people who make things.
 end of paragraph
 image, image
 region, Projects
 figure
-image, photo
 caption
 Harvest Table — identity
 end of caption
 end of figure
 figure
-image, image
 caption
 Lumen — packaging
 end of caption
 end of figure
 figure
-image, picture
 caption
 Verge — campaign
 end of caption
 end of figure
 end of region, Projects
+end of main
+contentinfo
+paragraph
+© Atlas Studio.
+link, Instagram
+end of paragraph
+end of contentinfo
+end of document
+document
```

### alt-is-filename

_adversarial · 2 traversal pass(es) in the window · **3 distinct phrase(s) removed, 9 added** (9/9 raw diff lines)_

```diff
 document
 banner
 link, Brightwell Clinic
 navigation, Primary
 link, Services
 link, Our team
 link, Book
 end of navigation, Primary
 end of banner
 main
 heading, Meet our care team, level 1
 paragraph
 Board-certified clinicians focused on whole-person primary care.
 end of paragraph
 region, Team members
-image, DSC_0042.jpg
 heading, Dr. Amara Osei, level 2
 paragraph
 Family Medicine
 end of paragraph
-image, IMG_20240118_final.jpg
 heading, Dr. Ravi Menon, level 2
 paragraph
 Internal Medicine
 end of paragraph
-image, headshot-v2-web.png
 heading, Nadia Petrova, NP, level 2
 paragraph
 Pediatrics
 end of paragraph
 end of region, Team members
 end of main
 contentinfo
 paragraph
 © Brightwell Clinic.
 link, Privacy
 ·
 link, Accessibility
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Brightwell Clinic
 navigation, Primary
 link, Services
 link, Our team
 link, Book
 end of navigation, Primary
 end of banner
 main
 heading, Meet our care team, level 1
 paragraph
 Board-certified clinicians focused on whole-person primary care.
 end of paragraph
 region, Team members
-image, DSC_0042.jpg
 heading, Dr. Amara Osei, level 2
 paragraph
 Family Medicine
 end of paragraph
-image, IMG_20240118_final.jpg
 heading, Dr. Ravi Menon, level 2
 paragraph
 Internal Medicine
 end of paragraph
-image, headshot-v2-web.png
 heading, Nadia Petrova, NP, level 2
 paragraph
 Pediatrics
 end of paragraph
 end of region, Team members
 end of main
 contentinfo
 paragraph
 © Brightwell Clinic.
 link, Privacy
 ·
 link, Accessibility
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Brightwell Clinic
 navigation, Primary
 link, Services
 link, Our team
 link, Book
 end of navigation, Primary
 end of banner
 main
 heading, Meet our care team, level 1
 paragraph
 Board-certified clinicians focused on whole-person primary care.
 end of paragraph
 region, Team members
-image, DSC_0042.jpg
 heading, Dr. Amara Osei, level 2
 paragraph
 Family Medicine
 end of paragraph
-image, IMG_20240118_final.jpg
 heading, Dr. Ravi Menon, level 2
 paragraph
 Internal Medicine
 end of paragraph
-image, headshot-v2-web.png
 heading, Nadia Petrova, NP, level 2
 paragraph
 Pediatrics
 end of paragraph
 end of region, Team members
 end of main
 contentinfo
 paragraph
 © Brightwell Clinic.
 link, Privacy
 ·
 link, Accessibility
 end of paragraph
+end of contentinfo
+end of document
+document
+banner
+link, Brightwell Clinic
+navigation, Primary
+link, Services
+link, Our team
+link, Book
```

### aria-label-contradicts

_adversarial · 0 traversal pass(es) in the window · **1 distinct phrase(s) removed, 1 added** (1/1 raw diff lines)_

```diff
 document
 banner
 link, Cedar & Co
 navigation, Primary
 link, Shop
 link, Help
 link, Sign in
 end of navigation, Primary
 end of banner
 main
 heading, Create your account, level 1
 paragraph
 Save your favourites and check out faster.
 end of paragraph
 form
 Full name
 textbox, Full name
 Email address
-textbox, Phone number
+textbox, Email address
 Password
 Password
```

### color-only-status

_adversarial · 2 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](color-only-status.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Parcelly
 navigation, Primary
 link, Orders
 link, Track
 link, Help
 end of navigation, Primary
 end of banner
 main
 heading, Your orders, level 1
 table, Order status
 caption, Order status
 rowgroup
 row, Order Date Total Status
 columnheader, Order
 columnheader, Date
 columnheader, Total
 columnheader, Status
 end of row, Order Date Total Status
 end of rowgroup
 rowgroup
 row, #10482 Aug 21 $54.00
 cell, #10482
 cell, Aug 21
 cell, $54.00
 cell
 end of row, #10482 Aug 21 $54.00
 row, #10471 Aug 19 $18.50
 cell, #10471
 cell, Aug 19
 cell, $18.50
 cell
 end of row, #10471 Aug 19 $18.50
 row, #10460 Aug 15 $132.00
 cell, #10460
 cell, Aug 15
 cell, $132.00
 cell
 end of row, #10460 Aug 15 $132.00
 end of rowgroup
 end of table, Order status
 end of main
 contentinfo
 paragraph
 © Parcelly.
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Parcelly
 navigation, Primary
 link, Orders
 link, Track
 link, Help
 end of navigation, Primary
 end of banner
 main
 heading, Your orders, level 1
 table, Order status
 caption, Order status
 rowgroup
 row, Order Date Total Status
 columnheader, Order
 columnheader, Date
 columnheader, Total
 columnheader, Status
 end of row, Order Date Total Status
 end of rowgroup
 rowgroup
 row, #10482 Aug 21 $54.00
 cell, #10482
 cell, Aug 21
 cell, $54.00
 cell
 end of row, #10482 Aug 21 $54.00
 row, #10471 Aug 19 $18.50
 cell, #10471
 cell, Aug 19
 cell, $18.50
 cell
 end of row, #10471 Aug 19 $18.50
 row, #10460 Aug 15 $132.00
 cell, #10460
 cell, Aug 15
 cell, $132.00
 cell
 end of row, #10460 Aug 15 $132.00
 end of rowgroup
 end of table, Order status
 end of main
 contentinfo
 paragraph
 © Parcelly.
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Parcelly
 navigation, Primary
 link, Orders
 link, Track
 link, Help
 end of navigation, Primary
 end of banner
 main
 heading, Your orders, level 1
 table, Order status
 caption, Order status
 rowgroup
 row, Order Date Total Status
 columnheader, Order
 columnheader, Date
 columnheader, Total
 columnheader, Status
 end of row, Order Date Total Status
 end of rowgroup
```

### css-reorder

_adversarial · 1 traversal pass(es) in the window · **21 distinct phrase(s) removed, 28 added** (28/28 raw diff lines)_

```diff
 document
 banner
 link, Meridian Cloud
 navigation, Primary
 link, Product
 link, Pricing
 link, Docs
 end of navigation, Primary
 end of banner
 main
 heading, Simple, scalable pricing, level 1
 paragraph
 Start free. Upgrade when your team grows. Cancel anytime.
 end of paragraph
 region, Pricing plans
 article
-heading, Enterprise, level 2
-Custom
-list
-listitem, level 1, position 1, set size 3
-SSO & SCIM
-end of listitem, level 1, position 1, set size 3
-listitem, level 1, position 2, set size 3
-99.99% uptime SLA
-end of listitem, level 1, position 2, set size 3
-listitem, level 1, position 3, set size 3
-Dedicated support
-end of listitem, level 1, position 3, set size 3
-end of list
-link, Contact sales
-end of article
-article
 heading, Starter, level 2
 $0
 /mo
 list
 listitem, level 1, position 1, set size 3
 1 project
 end of listitem, level 1, position 1, set size 3
 listitem, level 1, position 2, set size 3
 Community support
 end of listitem, level 1, position 2, set size 3
 listitem, level 1, position 3, set size 3
 1 GB storage
 end of listitem, level 1, position 3, set size 3
 end of list
 link, Get started
 end of article
 article
 heading, Team, level 2
 $29
 /mo
 list
 listitem, level 1, position 1, set size 3
 Unlimited projects
 end of listitem, level 1, position 1, set size 3
 listitem, level 1, position 2, set size 3
 Email support
 end of listitem, level 1, position 2, set size 3
 listitem, level 1, position 3, set size 3
 100 GB storage
 end of listitem, level 1, position 3, set size 3
 end of list
 link, Start Team trial
 end of article
+article
+heading, Enterprise, level 2
+Custom
+list
+listitem, level 1, position 1, set size 3
+SSO & SCIM
+end of listitem, level 1, position 1, set size 3
+listitem, level 1, position 2, set size 3
+99.99% uptime SLA
+end of listitem, level 1, position 2, set size 3
+listitem, level 1, position 3, set size 3
+Dedicated support
+end of listitem, level 1, position 3, set size 3
+end of list
+link, Contact sales
+end of article
 end of region, Pricing plans
 end of main
 contentinfo
 paragraph
 © Meridian Cloud.
 link, Terms
 ·
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Meridian Cloud
 navigation, Primary
 link, Product
 link, Pricing
 link, Docs
 end of navigation, Primary
 end of banner
 main
 heading, Simple, scalable pricing, level 1
 paragraph
 Start free. Upgrade when your team grows. Cancel anytime.
 end of paragraph
 region, Pricing plans
 article
-heading, Enterprise, level 2
-Custom
+heading, Starter, level 2
+$0
+/mo
 list
 listitem, level 1, position 1, set size 3
-SSO & SCIM
+1 project
 end of listitem, level 1, position 1, set size 3
 listitem, level 1, position 2, set size 3
-99.99% uptime SLA
+Community support
 end of listitem, level 1, position 2, set size 3
 listitem, level 1, position 3, set size 3
-Dedicated support
+1 GB storage
 end of listitem, level 1, position 3, set size 3
 end of list
-link, Contact sales
+link, Get started
 end of article
 article
-heading, Starter, level 2
-$0
+heading, Team, level 2
+$29
 /mo
 list
 listitem, level 1, position 1, set size 3
-1 project
+Unlimited projects
 end of listitem, level 1, position 1, set size 3
 listitem, level 1, position 2, set size 3
-Community support
+Email support
 end of listitem, level 1, position 2, set size 3
 listitem, level 1, position 3, set size 3
-1 GB storage
-end of listitem, level 1, position 3, set size 3
+100 GB storage
```

### div-button-no-keys

_adversarial · 4 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](div-button-no-keys.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Summit
 navigation, Primary
 link, Features
 link, Pricing
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Frequently asked questions, level 1
 button, How do I reset my password?, 1 control, not expanded
 How do I reset my password?
 end of button, How do I reset my password?, 1 control, not expanded
 button, Can I change my plan later?, 1 control, not expanded
 Can I change my plan later?
 end of button, Can I change my plan later?, 1 control, not expanded
 button, Do you offer refunds?, 1 control, not expanded
 Do you offer refunds?
 end of button, Do you offer refunds?, 1 control, not expanded
 end of main
 contentinfo
 paragraph
 © Summit.
 link, System status
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Summit
 navigation, Primary
 link, Features
 link, Pricing
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Frequently asked questions, level 1
 button, How do I reset my password?, 1 control, not expanded
 How do I reset my password?
 end of button, How do I reset my password?, 1 control, not expanded
 button, Can I change my plan later?, 1 control, not expanded
 Can I change my plan later?
 end of button, Can I change my plan later?, 1 control, not expanded
 button, Do you offer refunds?, 1 control, not expanded
 Do you offer refunds?
 end of button, Do you offer refunds?, 1 control, not expanded
 end of main
 contentinfo
 paragraph
 © Summit.
 link, System status
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Summit
 navigation, Primary
 link, Features
 link, Pricing
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Frequently asked questions, level 1
 button, How do I reset my password?, 1 control, not expanded
 How do I reset my password?
 end of button, How do I reset my password?, 1 control, not expanded
 button, Can I change my plan later?, 1 control, not expanded
 Can I change my plan later?
 end of button, Can I change my plan later?, 1 control, not expanded
 button, Do you offer refunds?, 1 control, not expanded
 Do you offer refunds?
 end of button, Do you offer refunds?, 1 control, not expanded
 end of main
 contentinfo
 paragraph
 © Summit.
 link, System status
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Summit
 navigation, Primary
 link, Features
 link, Pricing
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Frequently asked questions, level 1
 button, How do I reset my password?, 1 control, not expanded
 How do I reset my password?
 end of button, How do I reset my password?, 1 control, not expanded
 button, Can I change my plan later?, 1 control, not expanded
 Can I change my plan later?
 end of button, Can I change my plan later?, 1 control, not expanded
 button, Do you offer refunds?, 1 control, not expanded
 Do you offer refunds?
 end of button, Do you offer refunds?, 1 control, not expanded
 end of main
 contentinfo
 paragraph
 © Summit.
 link, System status
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Summit
 navigation, Primary
 link, Features
 link, Pricing
 link, Support
 end of navigation, Primary
 end of banner
```

### heading-skip

_adversarial · 3 traversal pass(es) in the window · **3 distinct phrase(s) removed, 3 added** (11/11 raw diff lines)_

```diff
 document
 banner
 link, Orchard Co-op
 navigation, Primary
 link, Join
 link, Handbook
 link, Events
 end of navigation, Primary
 end of banner
 main
 heading, Member handbook, level 1
 paragraph
 Everything you need to know about being part of the co-op, from shifts to shared harvests.
 end of paragraph
-heading, Your monthly shift, level 4
+heading, Your monthly shift, level 2
 paragraph
 Every working member commits to one three-hour shift per month. Sign up on the board by the first Sunday.
 end of paragraph
-heading, Sharing the harvest, level 4
+heading, Sharing the harvest, level 2
 paragraph
 Surplus produce is divided evenly at the end of each week. Bring your own bags.
 end of paragraph
-heading, Getting in touch, level 4
+heading, Getting in touch, level 2
 paragraph
 Questions? Email the coordinators or drop by the office during market hours.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Orchard Co-op.
 link, Bylaws
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Orchard Co-op
 navigation, Primary
 link, Join
 link, Handbook
 link, Events
 end of navigation, Primary
 end of banner
 main
 heading, Member handbook, level 1
 paragraph
 Everything you need to know about being part of the co-op, from shifts to shared harvests.
 end of paragraph
-heading, Your monthly shift, level 4
+heading, Your monthly shift, level 2
 paragraph
 Every working member commits to one three-hour shift per month. Sign up on the board by the first Sunday.
 end of paragraph
-heading, Sharing the harvest, level 4
+heading, Sharing the harvest, level 2
 paragraph
 Surplus produce is divided evenly at the end of each week. Bring your own bags.
 end of paragraph
-heading, Getting in touch, level 4
+heading, Getting in touch, level 2
 paragraph
 Questions? Email the coordinators or drop by the office during market hours.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Orchard Co-op.
 link, Bylaws
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Orchard Co-op
 navigation, Primary
 link, Join
 link, Handbook
 link, Events
 end of navigation, Primary
 end of banner
 main
 heading, Member handbook, level 1
 paragraph
 Everything you need to know about being part of the co-op, from shifts to shared harvests.
 end of paragraph
-heading, Your monthly shift, level 4
+heading, Your monthly shift, level 2
 paragraph
 Every working member commits to one three-hour shift per month. Sign up on the board by the first Sunday.
 end of paragraph
-heading, Sharing the harvest, level 4
+heading, Sharing the harvest, level 2
 paragraph
 Surplus produce is divided evenly at the end of each week. Bring your own bags.
 end of paragraph
-heading, Getting in touch, level 4
+heading, Getting in touch, level 2
 paragraph
 Questions? Email the coordinators or drop by the office during market hours.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Orchard Co-op.
 link, Bylaws
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Orchard Co-op
 navigation, Primary
 link, Join
 link, Handbook
 link, Events
 end of navigation, Primary
 end of banner
 main
 heading, Member handbook, level 1
 paragraph
 Everything you need to know about being part of the co-op, from shifts to shared harvests.
 end of paragraph
-heading, Your monthly shift, level 4
+heading, Your monthly shift, level 2
 paragraph
 Every working member commits to one three-hour shift per month. Sign up on the board by the first Sunday.
 end of paragraph
-heading, Sharing the harvest, level 4
+heading, Sharing the harvest, level 2
```

### icon-only-control

_adversarial · 4 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](icon-only-control.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Loop
 navigation, Primary
 link, Browse
 link, Library
 link, Account
 end of navigation, Primary
 end of banner
 main
 heading, Your library, level 1
 Ceremony
 The Silver Lines
 button, Play Ceremony by The Silver Lines
 ▶
 end of button, Play Ceremony by The Silver Lines
 Northbound
 Iris Vale
 button, Play Northbound by Iris Vale
 ▶
 end of button, Play Northbound by Iris Vale
 end of main
 contentinfo
 paragraph
 © Loop Audio.
 link, Terms
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Loop
 navigation, Primary
 link, Browse
 link, Library
 link, Account
 end of navigation, Primary
 end of banner
 main
 heading, Your library, level 1
 Ceremony
 The Silver Lines
 button, Play Ceremony by The Silver Lines
 ▶
 end of button, Play Ceremony by The Silver Lines
 Northbound
 Iris Vale
 button, Play Northbound by Iris Vale
 ▶
 end of button, Play Northbound by Iris Vale
 end of main
 contentinfo
 paragraph
 © Loop Audio.
 link, Terms
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Loop
 navigation, Primary
 link, Browse
 link, Library
 link, Account
 end of navigation, Primary
 end of banner
 main
 heading, Your library, level 1
 Ceremony
 The Silver Lines
 button, Play Ceremony by The Silver Lines
 ▶
 end of button, Play Ceremony by The Silver Lines
 Northbound
 Iris Vale
 button, Play Northbound by Iris Vale
 ▶
 end of button, Play Northbound by Iris Vale
 end of main
 contentinfo
 paragraph
 © Loop Audio.
 link, Terms
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Loop
 navigation, Primary
 link, Browse
 link, Library
 link, Account
 end of navigation, Primary
 end of banner
 main
 heading, Your library, level 1
 Ceremony
 The Silver Lines
 button, Play Ceremony by The Silver Lines
 ▶
 end of button, Play Ceremony by The Silver Lines
 Northbound
 Iris Vale
 button, Play Northbound by Iris Vale
 ▶
 end of button, Play Northbound by Iris Vale
 end of main
 contentinfo
 paragraph
 © Loop Audio.
 link, Terms
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Loop
 navigation, Primary
 link, Browse
```

### informative-emptied

_adversarial · 3 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](informative-emptied.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Northstar Energy
 navigation, Primary
 link, Reports
 link, Impact
 link, Investors
 end of navigation, Primary
 end of banner
 main
 heading, 2024 impact report, level 1
 paragraph
 Our progress toward net-zero operations, by the numbers.
 end of paragraph
 paragraph
 Carbon intensity fell for the fourth consecutive year as we brought new solar capacity online and retired two legacy gas plants.
 end of paragraph
 figure
 caption
 Figure 1
 end of caption
 end of figure
 paragraph
 The chart above shows Scope 1 and 2 emissions declining from 4.1M tonnes CO2e in 2020 to 2.3M tonnes in 2024 — a 44% reduction against a 2019 baseline.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northstar Energy.
 link, Download full report (PDF)
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northstar Energy
 navigation, Primary
 link, Reports
 link, Impact
 link, Investors
 end of navigation, Primary
 end of banner
 main
 heading, 2024 impact report, level 1
 paragraph
 Our progress toward net-zero operations, by the numbers.
 end of paragraph
 paragraph
 Carbon intensity fell for the fourth consecutive year as we brought new solar capacity online and retired two legacy gas plants.
 end of paragraph
 figure
 caption
 Figure 1
 end of caption
 end of figure
 paragraph
 The chart above shows Scope 1 and 2 emissions declining from 4.1M tonnes CO2e in 2020 to 2.3M tonnes in 2024 — a 44% reduction against a 2019 baseline.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northstar Energy.
 link, Download full report (PDF)
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northstar Energy
 navigation, Primary
 link, Reports
 link, Impact
 link, Investors
 end of navigation, Primary
 end of banner
 main
 heading, 2024 impact report, level 1
 paragraph
 Our progress toward net-zero operations, by the numbers.
 end of paragraph
 paragraph
 Carbon intensity fell for the fourth consecutive year as we brought new solar capacity online and retired two legacy gas plants.
 end of paragraph
 figure
 caption
 Figure 1
 end of caption
 end of figure
 paragraph
 The chart above shows Scope 1 and 2 emissions declining from 4.1M tonnes CO2e in 2020 to 2.3M tonnes in 2024 — a 44% reduction against a 2019 baseline.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northstar Energy.
 link, Download full report (PDF)
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northstar Energy
 navigation, Primary
 link, Reports
 link, Impact
 link, Investors
 end of navigation, Primary
 end of banner
 main
 heading, 2024 impact report, level 1
 paragraph
 Our progress toward net-zero operations, by the numbers.
 end of paragraph
 paragraph
 Carbon intensity fell for the fourth consecutive year as we brought new solar capacity online and retired two legacy gas plants.
 end of paragraph
 figure
 caption
 Figure 1
 end of caption
 end of figure
```

### keyboard-trap-modal

_adversarial · 3 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](keyboard-trap-modal.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Northwind Outfitters
 navigation, Primary
 link, Gear
 link, Trails
 link, About
 end of navigation, Primary
 end of banner
 main
 heading, Backcountry gear, field-tested, level 1
 paragraph
 Packs, shells and boots built for long days on the trail. Join our list for restock alerts.
 end of paragraph
 heading, Never miss a restock, level 2
 paragraph
 Our small-batch items sell out fast. Get an email the moment they're back.
 end of paragraph
 button, Subscribe for alerts
 paragraph
 Trusted by 40,000+ hikers. Free returns within 60 days on all orders.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northwind Outfitters.
 link, Privacy
 ·
 link, Contact
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northwind Outfitters
 navigation, Primary
 link, Gear
 link, Trails
 link, About
 end of navigation, Primary
 end of banner
 main
 heading, Backcountry gear, field-tested, level 1
 paragraph
 Packs, shells and boots built for long days on the trail. Join our list for restock alerts.
 end of paragraph
 heading, Never miss a restock, level 2
 paragraph
 Our small-batch items sell out fast. Get an email the moment they're back.
 end of paragraph
 button, Subscribe for alerts
 paragraph
 Trusted by 40,000+ hikers. Free returns within 60 days on all orders.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northwind Outfitters.
 link, Privacy
 ·
 link, Contact
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northwind Outfitters
 navigation, Primary
 link, Gear
 link, Trails
 link, About
 end of navigation, Primary
 end of banner
 main
 heading, Backcountry gear, field-tested, level 1
 paragraph
 Packs, shells and boots built for long days on the trail. Join our list for restock alerts.
 end of paragraph
 heading, Never miss a restock, level 2
 paragraph
 Our small-batch items sell out fast. Get an email the moment they're back.
 end of paragraph
 button, Subscribe for alerts
 paragraph
 Trusted by 40,000+ hikers. Free returns within 60 days on all orders.
 end of paragraph
 end of main
 contentinfo
 paragraph
 © Northwind Outfitters.
 link, Privacy
 ·
 link, Contact
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Northwind Outfitters
 navigation, Primary
 link, Gear
 link, Trails
 link, About
 end of navigation, Primary
 end of banner
 main
 heading, Backcountry gear, field-tested, level 1
 paragraph
 Packs, shells and boots built for long days on the trail. Join our list for restock alerts.
 end of paragraph
 heading, Never miss a restock, level 2
 paragraph
 Our small-batch items sell out fast. Get an email the moment they're back.
 end of paragraph
 button, Subscribe for alerts
 paragraph
 Trusted by 40,000+ hikers. Free returns within 60 days on all orders.
 end of paragraph
 end of main
 contentinfo
 paragraph
```

### live-region-missing

_adversarial · 4 traversal pass(es) in the window · **4 distinct phrase(s) removed, 1 added** (4/4 raw diff lines)_

```diff
 document
 banner
 link, Fern & Fable
 navigation, Primary
 link, Shop
 link, Our story
 link, Cart
 end of navigation, Primary
 end of banner
 main
 Product photo
 heading, Stoneware mug — Ochre, level 1
 $28.00
 paragraph
 Hand-glazed 12 oz stoneware, microwave and dishwasher safe. Each piece varies slightly.
 end of paragraph
 Quantity
 spinbutton, Quantity, 1, max value 9, min value 1
 button, Add to cart
+status
 end of main
 contentinfo
 paragraph
 © Fern & Fable Ceramics.
 link, Shipping
 ·
 link, Returns
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Fern & Fable
 navigation, Primary
 link, Shop
 link, Our story
 link, Cart
 end of navigation, Primary
 end of banner
 main
 Product photo
 heading, Stoneware mug — Ochre, level 1
 $28.00
 paragraph
 Hand-glazed 12 oz stoneware, microwave and dishwasher safe. Each piece varies slightly.
 end of paragraph
 Quantity
 spinbutton, Quantity, 1, max value 9, min value 1
 button, Add to cart
+status
 end of main
 contentinfo
 paragraph
 © Fern & Fable Ceramics.
 link, Shipping
 ·
 link, Returns
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Fern & Fable
 navigation, Primary
 link, Shop
 link, Our story
 link, Cart
 end of navigation, Primary
 end of banner
 main
 Product photo
 heading, Stoneware mug — Ochre, level 1
 $28.00
 paragraph
 Hand-glazed 12 oz stoneware, microwave and dishwasher safe. Each piece varies slightly.
 end of paragraph
 Quantity
 spinbutton, Quantity, 1, max value 9, min value 1
 button, Add to cart
+status
 end of main
 contentinfo
 paragraph
 © Fern & Fable Ceramics.
 link, Shipping
 ·
 link, Returns
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Fern & Fable
 navigation, Primary
 link, Shop
 link, Our story
 link, Cart
 end of navigation, Primary
 end of banner
 main
 Product photo
 heading, Stoneware mug — Ochre, level 1
 $28.00
 paragraph
 Hand-glazed 12 oz stoneware, microwave and dishwasher safe. Each piece varies slightly.
 end of paragraph
 Quantity
 spinbutton, Quantity, 1, max value 9, min value 1
 button, Add to cart
+status
 end of main
 contentinfo
 paragraph
 © Fern & Fable Ceramics.
 link, Shipping
 ·
 link, Returns
 end of paragraph
 end of contentinfo
 end of document
 document
-banner
-link, Fern & Fable
-navigation, Primary
-link, Shop
```

### placeholder-as-label

_adversarial · 4 traversal pass(es) in the window · **5 distinct phrase(s) removed, 5 added** (20/20 raw diff lines)_

```diff
 document
 banner
 link, Wander
 navigation, Primary
 link, Stays
 link, Experiences
 link, Trips
 end of navigation, Primary
 end of banner
 main
 heading, Book your stay, level 1
 paragraph
 Tell us a few details and we'll hold your dates.
 end of paragraph
 form
-textbox, placeholder Full name
-textbox, placeholder Email address
-textbox, placeholder Check-in (MM/DD/YYYY)
-textbox, placeholder Check-out (MM/DD/YYYY)
-spinbutton, max value 12, min value 1
+textbox, Full name, placeholder Full name
+textbox, Email address, placeholder Email address
+textbox, Check-in (MM/DD/YYYY), placeholder Check-in (MM/DD/YYYY)
+textbox, Check-out (MM/DD/YYYY), placeholder Check-out (MM/DD/YYYY)
+spinbutton, Guests, max value 12, min value 1
 button, Request booking
 end of form
 end of main
 contentinfo
 paragraph
 © Wander Travel.
 link, Help
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Wander
 navigation, Primary
 link, Stays
 link, Experiences
 link, Trips
 end of navigation, Primary
 end of banner
 main
 heading, Book your stay, level 1
 paragraph
 Tell us a few details and we'll hold your dates.
 end of paragraph
 form
-textbox, placeholder Full name
-textbox, placeholder Email address
-textbox, placeholder Check-in (MM/DD/YYYY)
-textbox, placeholder Check-out (MM/DD/YYYY)
-spinbutton, max value 12, min value 1
+textbox, Full name, placeholder Full name
+textbox, Email address, placeholder Email address
+textbox, Check-in (MM/DD/YYYY), placeholder Check-in (MM/DD/YYYY)
+textbox, Check-out (MM/DD/YYYY), placeholder Check-out (MM/DD/YYYY)
+spinbutton, Guests, max value 12, min value 1
 button, Request booking
 end of form
 end of main
 contentinfo
 paragraph
 © Wander Travel.
 link, Help
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Wander
 navigation, Primary
 link, Stays
 link, Experiences
 link, Trips
 end of navigation, Primary
 end of banner
 main
 heading, Book your stay, level 1
 paragraph
 Tell us a few details and we'll hold your dates.
 end of paragraph
 form
-textbox, placeholder Full name
-textbox, placeholder Email address
-textbox, placeholder Check-in (MM/DD/YYYY)
-textbox, placeholder Check-out (MM/DD/YYYY)
-spinbutton, max value 12, min value 1
+textbox, Full name, placeholder Full name
+textbox, Email address, placeholder Email address
+textbox, Check-in (MM/DD/YYYY), placeholder Check-in (MM/DD/YYYY)
+textbox, Check-out (MM/DD/YYYY), placeholder Check-out (MM/DD/YYYY)
+spinbutton, Guests, max value 12, min value 1
 button, Request booking
 end of form
 end of main
 contentinfo
 paragraph
 © Wander Travel.
 link, Help
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Wander
 navigation, Primary
 link, Stays
 link, Experiences
 link, Trips
 end of navigation, Primary
 end of banner
 main
 heading, Book your stay, level 1
 paragraph
 Tell us a few details and we'll hold your dates.
 end of paragraph
 form
-textbox, placeholder Full name
-textbox, placeholder Email address
-textbox, placeholder Check-in (MM/DD/YYYY)
-textbox, placeholder Check-out (MM/DD/YYYY)
-spinbutton, max value 12, min value 1
+textbox, Full name, placeholder Full name
+textbox, Email address, placeholder Email address
+textbox, Check-in (MM/DD/YYYY), placeholder Check-in (MM/DD/YYYY)
+textbox, Check-out (MM/DD/YYYY), placeholder Check-out (MM/DD/YYYY)
+spinbutton, Guests, max value 12, min value 1
 button, Request booking
 end of form
 end of main
 contentinfo
 paragraph
 © Wander Travel.
 link, Help
 end of paragraph
 end of contentinfo
 end of document
 document
```

### positive-tabindex

_adversarial · 3 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](positive-tabindex.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Harbor Bank
 navigation, Primary
 link, Accounts
 link, Loans
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Contact our team, level 1
 paragraph
 Questions about your account? Send us a note and we'll reply within one business day.
 end of paragraph
 form
 First name
 textbox, First name
 Last name
 textbox, Last name
 Email address
 textbox, Email address
 Reason for contact
 combobox, Reason for contact, General question, has popup listbox, not expanded
 option, General question, not selected, position 1, set size 3
 option, Report a problem, not selected, position 2, set size 3
 option, Close my account, not selected, position 3, set size 3
 end of combobox, Reason for contact, General question, has popup listbox, not expanded
 Message
 textbox, Message
 button, Send message
 end of form
 end of main
 contentinfo
 paragraph
 © Harbor Bank. Member FDIC.
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Harbor Bank
 navigation, Primary
 link, Accounts
 link, Loans
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Contact our team, level 1
 paragraph
 Questions about your account? Send us a note and we'll reply within one business day.
 end of paragraph
 form
 First name
 textbox, First name
 Last name
 textbox, Last name
 Email address
 textbox, Email address
 Reason for contact
 combobox, Reason for contact, General question, has popup listbox, not expanded
 option, General question, not selected, position 1, set size 3
 option, Report a problem, not selected, position 2, set size 3
 option, Close my account, not selected, position 3, set size 3
 end of combobox, Reason for contact, General question, has popup listbox, not expanded
 Message
 textbox, Message
 button, Send message
 end of form
 end of main
 contentinfo
 paragraph
 © Harbor Bank. Member FDIC.
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Harbor Bank
 navigation, Primary
 link, Accounts
 link, Loans
 link, Support
 end of navigation, Primary
 end of banner
 main
 heading, Contact our team, level 1
 paragraph
 Questions about your account? Send us a note and we'll reply within one business day.
 end of paragraph
 form
 First name
 textbox, First name
 Last name
 textbox, Last name
 Email address
 textbox, Email address
 Reason for contact
 combobox, Reason for contact, General question, has popup listbox, not expanded
 option, General question, not selected, position 1, set size 3
 option, Report a problem, not selected, position 2, set size 3
 option, Close my account, not selected, position 3, set size 3
 end of combobox, Reason for contact, General question, has popup listbox, not expanded
 Message
 textbox, Message
 button, Send message
 end of form
 end of main
 contentinfo
 paragraph
 © Harbor Bank. Member FDIC.
 link, Privacy
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Harbor Bank
 navigation, Primary
```

### redundant-alt-decorative

_adversarial · 3 traversal pass(es) in the window · **1 distinct phrase(s) removed, 4 added** (4/4 raw diff lines)_

```diff
 document
 banner
 link, Still Waters
 navigation, Primary
 link, Essays
 link, About
 end of navigation, Primary
 end of banner
 main
 article
 heading, On slowness, level 1
 paragraph
 by E. Hartley · 6 min read
 end of paragraph
 paragraph
 There is a particular quiet that arrives only when you stop trying to fill it. We have engineered our days to eliminate exactly this, and then wonder why we feel so thin.
 end of paragraph
-image, decorative ornamental flourish divider image separating the two sections of the essay
 paragraph
 Slowness is not laziness. It is attention paid at a sustainable rate. The garden does not hurry, and yet everything gets done.
 end of paragraph
 paragraph
 Perhaps the task is not to do less, but to want less all at once.
 end of paragraph
 end of article
 end of main
 contentinfo
 paragraph
 © Still Waters.
 link, RSS
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Still Waters
 navigation, Primary
 link, Essays
 link, About
 end of navigation, Primary
 end of banner
 main
 article
 heading, On slowness, level 1
 paragraph
 by E. Hartley · 6 min read
 end of paragraph
 paragraph
 There is a particular quiet that arrives only when you stop trying to fill it. We have engineered our days to eliminate exactly this, and then wonder why we feel so thin.
 end of paragraph
-image, decorative ornamental flourish divider image separating the two sections of the essay
 paragraph
 Slowness is not laziness. It is attention paid at a sustainable rate. The garden does not hurry, and yet everything gets done.
 end of paragraph
 paragraph
 Perhaps the task is not to do less, but to want less all at once.
 end of paragraph
 end of article
 end of main
 contentinfo
 paragraph
 © Still Waters.
 link, RSS
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Still Waters
 navigation, Primary
 link, Essays
 link, About
 end of navigation, Primary
 end of banner
 main
 article
 heading, On slowness, level 1
 paragraph
 by E. Hartley · 6 min read
 end of paragraph
 paragraph
 There is a particular quiet that arrives only when you stop trying to fill it. We have engineered our days to eliminate exactly this, and then wonder why we feel so thin.
 end of paragraph
-image, decorative ornamental flourish divider image separating the two sections of the essay
 paragraph
 Slowness is not laziness. It is attention paid at a sustainable rate. The garden does not hurry, and yet everything gets done.
 end of paragraph
 paragraph
 Perhaps the task is not to do less, but to want less all at once.
 end of paragraph
 end of article
 end of main
 contentinfo
 paragraph
 © Still Waters.
 link, RSS
 end of paragraph
 end of contentinfo
 end of document
 document
 banner
 link, Still Waters
 navigation, Primary
 link, Essays
 link, About
 end of navigation, Primary
 end of banner
 main
 article
 heading, On slowness, level 1
 paragraph
 by E. Hartley · 6 min read
 end of paragraph
 paragraph
 There is a particular quiet that arrives only when you stop trying to fill it. We have engineered our days to eliminate exactly this, and then wonder why we feel so thin.
 end of paragraph
-image, decorative ornamental flourish divider image separating the two sections of the essay
 paragraph
 Slowness is not laziness. It is attention paid at a sustainable rate. The garden does not hurry, and yet everything gets done.
 end of paragraph
 paragraph
+Perhaps the task is not to do less, but to want less all at once.
+end of paragraph
+end of article
+end of main
```

### skip-link-broken

_adversarial · 1 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](skip-link-broken.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 link, Skip to main content
 banner
 link, The Daily Ledger
 Tuesday edition
 navigation, Sections
 list
 listitem, level 1, position 1, set size 5
 link, Markets
 end of listitem, level 1, position 1, set size 5
 listitem, level 1, position 2, set size 5
 link, Business
 end of listitem, level 1, position 2, set size 5
 listitem, level 1, position 3, set size 5
 link, Technology
 end of listitem, level 1, position 3, set size 5
 listitem, level 1, position 4, set size 5
 link, Opinion
 end of listitem, level 1, position 4, set size 5
 listitem, level 1, position 5, set size 5
 link, World
 end of listitem, level 1, position 5, set size 5
 end of list
 end of navigation, Sections
 end of banner
 main
 article
 heading, Markets steady as investors weigh rate path, level 1
 paragraph
 Equities held near record highs on Tuesday as traders parsed fresh signals on the central bank's next move, with volatility subdued across major indices.
 end of paragraph
 paragraph
 Analysts pointed to resilient consumer spending and cooling inflation as reasons for cautious optimism heading into the second half.
 end of paragraph
 paragraph
 Bond yields ticked lower, while the dollar was little changed against a basket of peers.
 end of paragraph
 end of article
 end of main
 complementary, Related
 paragraph
 strong
 Most read
 end of strong
 end of paragraph
 paragraph
 link, Why small caps are lagging
 end of paragraph
 paragraph
 link, A quiet quarter for IPOs
 end of paragraph
 end of complementary, Related
 contentinfo
 paragraph
 © The Daily Ledger.
 link, About
 ·
 link, Contact
 end of paragraph
 end of contentinfo
 end of document
 document
 link, Skip to main content
 banner
 link, The Daily Ledger
 Tuesday edition
 navigation, Sections
 list
 listitem, level 1, position 1, set size 5
 link, Markets
 end of listitem, level 1, position 1, set size 5
 listitem, level 1, position 2, set size 5
 link, Business
 end of listitem, level 1, position 2, set size 5
 listitem, level 1, position 3, set size 5
 link, Technology
 end of listitem, level 1, position 3, set size 5
 listitem, level 1, position 4, set size 5
 link, Opinion
 end of listitem, level 1, position 4, set size 5
 listitem, level 1, position 5, set size 5
 link, World
 end of listitem, level 1, position 5, set size 5
 end of list
 end of navigation, Sections
 end of banner
 main
 article
 heading, Markets steady as investors weigh rate path, level 1
 paragraph
 Equities held near record highs on Tuesday as traders parsed fresh signals on the central bank's next move, with volatility subdued across major indices.
 end of paragraph
 paragraph
 Analysts pointed to resilient consumer spending and cooling inflation as reasons for cautious optimism heading into the second half.
 end of paragraph
 paragraph
 Bond yields ticked lower, while the dollar was little changed against a basket of peers.
 end of paragraph
 end of article
 end of main
 complementary, Related
 paragraph
 strong
 Most read
 end of strong
 end of paragraph
 paragraph
 link, Why small caps are lagging
 end of paragraph
 paragraph
 link, A quiet quarter for IPOs
 end of paragraph
 end of complementary, Related
 contentinfo
 paragraph
 © The Daily Ledger.
 link, About
 ·
 link, Contact
 end of paragraph
 end of contentinfo
```

### inj-alt-filename-heading

_injected · 7 traversal pass(es) in the window · **2 distinct phrase(s) removed, 8 added** (14/14 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Our team, level 1
-image, IMG_5521.jpg
-heading, Jordan Lee, level 3
+heading, Jordan Lee, level 2
 paragraph
 Engineering
 end of paragraph
 end of main
 end of document
 document
 banner
+link, Beacon
+navigation, Primary
+link, Home
+link, More
+end of navigation, Primary
+end of banner
+main
```

### inj-alt-generic-caption

_injected · 5 traversal pass(es) in the window · **1 distinct phrase(s) removed, 6 added** (6/6 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
 paragraph
 We broke camp before first light.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
 paragraph
 We broke camp before first light.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
 paragraph
 We broke camp before first light.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
 paragraph
 We broke camp before first light.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
 paragraph
 We broke camp before first light.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Field notes, level 1
 figure
-image, image
 caption
 Sunrise over the ridge at base camp
 end of caption
 end of figure
+paragraph
+We broke camp before first light.
+end of paragraph
+end of main
+end of document
+document
```

### inj-aria-label-mismatch

_injected · 7 traversal pass(es) in the window · **1 distinct phrase(s) removed, 1 added** (7/7 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Payment, level 1
 form
 Card number
-textbox, Expiry date
+textbox, Card number
 button, Pay
 end of form
 end of main
 end of document
 document
 banner
```

### inj-css-reorder

_injected · 8 traversal pass(es) in the window · **1 distinct phrase(s) removed, 1 added** (8/8 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Three steps, level 1
-Step one: sign up
 Step two: connect
 Step three: launch
+Step one: sign up
 end of main
 end of document
 document
```

### inj-decorative-alt

_injected · 6 traversal pass(es) in the window · **1 distinct phrase(s) removed, 6 added** (6/6 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, On stillness, level 1
 paragraph
 There is a quiet that arrives only when you stop filling it.
 end of paragraph
-image, decorative ornamental divider swirl
 paragraph
 The garden does not hurry, and yet everything is done.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
+end of banner
+main
+heading, On stillness, level 1
+paragraph
+There is a quiet that arrives only when you stop filling it.
+end of paragraph
```

### inj-div-button

_injected · 9 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](inj-div-button.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, FAQ, level 1
 button, How do I upgrade?, 1 control, not expanded
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
```

### inj-form-label

_injected · 7 traversal pass(es) in the window · **1 distinct phrase(s) removed, 1 added** (7/7 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Join the newsletter, level 1
 form
-textbox, placeholder Email address
+textbox, Email address, placeholder Email address
 button, Subscribe
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
```

### inj-heading-skip

_injected · 6 traversal pass(es) in the window · **1 distinct phrase(s) removed, 1 added** (6/6 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Team handbook, level 1
 paragraph
 Welcome aboard.
 end of paragraph
-heading, Your first week, level 3
+heading, Your first week, level 2
 paragraph
 Meet the team and set up your tools.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
```

### inj-icon-focus

_injected · 7 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](inj-icon-focus.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Now playing, level 1
 Track one
 button, Play track one
 ▶
 end of button, Play track one
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
```

### inj-live-region

_injected · 7 traversal pass(es) in the window · **6 distinct phrase(s) removed, 1 added** (6/6 raw diff lines)_

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
 button, Save
 end of form
+status
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Profile, level 1
 form
 Display name
 textbox, Display name
-button, Save
-end of form
-end of main
-end of document
-document
-banner
```

### inj-positive-tabindex

_injected · 6 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](inj-positive-tabindex.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 main
 heading, Contact support, level 1
 form
 Name
 textbox, Name
 Email
 textbox, Email
 button, Send
 end of form
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
```

### inj-skip-link

_injected · 7 traversal pass(es) in the window · **no audible change at this layer**_

The fix here is **operability, not announcement**: the agent made a control keyboard-
reachable/activatable (or let Escape dismiss a dialog), which a *reading-order* traversal
cannot show — it visits content regardless of focusability, and the accessible name was
already present. The repair is real and is evidenced by the Layer-B findings and this
page's [trajectory](inj-skip-link.md); it simply is not audible in this particular artifact.
Shown rather than omitted: an honest "no change here" is worth more than only the wins.

```diff
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
 main
 heading, Getting started, level 1
 paragraph
 Read the guide below to set up your first project in minutes.
 end of paragraph
 end of main
 end of document
 document
 banner
 link, Beacon
 navigation, Primary
 link, Home
 link, More
 end of navigation, Primary
 end of banner
 link, Skip to main content
```
