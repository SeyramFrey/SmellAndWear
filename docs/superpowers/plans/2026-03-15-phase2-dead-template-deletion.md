# Phase 2: Dead Template Code Deletion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all Velzon admin template dead code (charts pages, apps module, dead widgets, dead landing sections, dead store slices) that is not used by SmellAndWear, leaving only the live ecommerce/dashboard/auth code.

**Architecture:** Deletion-only pass — no refactoring, no renaming, no moving components. Each batch ends with `ng build --configuration production` to verify no compilation errors were introduced. Six independent batches in dependency order.

**Tech Stack:** Angular 18 (NgModule), NgRx 16, TypeScript, Deno Edge Functions (not touched in this phase)

**⚠ Golden Rules (from `docs/codebase-cleanup-plan.md`):**
- Delete only. Do not refactor. Do not rename.
- Run `ng build --configuration production` after **every** batch.
- A batch that fails the build must be fixed before moving to the next.
- No new files except moving `request.sql` → `docs/sql/` in Batch 2F.

---

## Chunk 1: Batches 2A–2C (pages/charts+apps, landing, widgets)

### Task 1 — Batch 2A: Delete `pages/apps/`, `pages/charts/`, `shared-modules/` and update routing

**Files:**
- Delete: `src/app/pages/apps/` (entire directory — Velzon admin apps section)
- Delete: `src/app/pages/charts/` (entire directory — Apexcharts, chartjs, echart subdirs + charts.module.ts)
- Delete: `src/app/shared-modules/` (entire directory — contains only orphan `feather-icons.module.ts`)
- Modify: `src/app/pages/pages.module.ts` (remove AppsModule import + import declaration)
- Modify: `src/app/pages/pages-routing.module.ts` (remove apps lazy-load route)

Note: `pages/charts/` and `src/app/shared-modules/` are not imported by any other file — no module updates required for them. Verified: `grep -r "ChartsModule\|charts.module\|shared-modules\|feather-icons.module" src/app --include="*.ts"` returns only the files within those directories themselves.

- [ ] **Step 1: Remove the `apps` lazy-load route from `pages-routing.module.ts`**

Remove this block from the routes array:
```
    {
      path: 'apps', loadChildren: () => import('./apps/apps.module').then(m => m.AppsModule)
    },
```

The resulting routes array should be:

```typescript
const routes: Routes = [
    {
        path: "",
        component: DashboardComponent
    },
    {
      path: '', loadChildren: () => import('./dashboards/dashboards.module').then(m => m.DashboardsModule)
    },
    {
        path: 'medias', loadChildren: () => import('./media/media.module').then(m => m.MediaModule)
    },

    {
      path: 'ecommerce', loadChildren: () => import('./ecommerce/ecommerce.module').then(m => m.EcommerceModule)
    },

];
```

- [ ] **Step 2: Remove `AppsModule` from `pages.module.ts`**

Remove the import line:
```typescript
import { AppsModule } from "./apps/apps.module";
```

Remove `AppsModule,` from the `imports` array. The imports array should no longer contain `AppsModule`.

- [ ] **Step 3: Delete the three dead directories**

```bash
rm -rf "C:/Projets/Smell_Wear/src/app/pages/apps"
rm -rf "C:/Projets/Smell_Wear/src/app/pages/charts"
rm -rf "C:/Projets/Smell_Wear/src/app/shared-modules"
```

- [ ] **Step 4: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: `Build at:` with exit code 0. No `Cannot find module './apps/apps.module'` errors.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/pages/ src/app/shared-modules/
git add src/app/pages/pages.module.ts src/app/pages/pages-routing.module.ts
git commit -m "feat(cleanup): Batch 2A — delete pages/apps, pages/charts, shared-modules"
```

(`git add -u` stages tracked file deletions; `git add` the two modified module files explicitly)

---

### Task 2 — Batch 2B: Delete dead landing sections and update `shared.module.ts`

**Files:**
- Delete: `src/app/shared/landing/nft/` (6 components: MarketPlaceComponent, WalletComponent, FeaturesComponent, CategoriesComponent, DiscoverComponent, TopCreatorComponent)
- Delete: `src/app/shared/landing/job/` (6 components: ProcessComponent, FindjobsComponent, CandidatesComponent, BlogComponent, JobcategoriesComponent, JobFooterComponent)
- Delete: `src/app/landing/profile/` (entire directory — profile + settings subdirs)
- Modify: `src/app/shared/shared.module.ts` (remove all 12 dead NFT + Job component declarations)

- [ ] **Step 1: Delete the dead landing directories**

```bash
rm -rf "C:/Projets/Smell_Wear/src/app/shared/landing/nft"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/landing/job"
rm -rf "C:/Projets/Smell_Wear/src/app/landing/profile"
```

- [ ] **Step 2: Rewrite `shared.module.ts` to remove all NFT and Job components**

The file should become:

```typescript
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbNavModule, NgbAccordionModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

// Swiper Slider
import { SlickCarouselModule } from 'ngx-slick-carousel';

// Counter
import { CountUpModule } from 'ngx-countup';

import { BreadcrumbsComponent } from './breadcrumbs/breadcrumbs.component';
import { ClientLogoComponent } from './landing/index/client-logo/client-logo.component';
import { ServicesComponent } from './landing/index/services/services.component';
import { FaqsComponent } from './landing/index/faqs/faqs.component';
import { CounterComponent } from './landing/index/counter/counter.component';
import { WorkProcessComponent } from './landing/index/work-process/work-process.component';
import { ContactComponent } from './landing/index/contact/contact.component';
import { FooterComponent } from './landing/index/footer/footer.component';
import { ScrollspyDirective } from './scrollspy.directive';
import { LandingScrollspyDirective } from './landingscrollspy.directive';


@NgModule({
  declarations: [
    BreadcrumbsComponent,
    ClientLogoComponent,
    ServicesComponent,
    FaqsComponent,
    CounterComponent,
    WorkProcessComponent,
    ContactComponent,
    FooterComponent,
    ScrollspyDirective,
    LandingScrollspyDirective
  ],
  imports: [
    CommonModule,
    NgbNavModule,
    NgbAccordionModule,
    NgbDropdownModule,
    SlickCarouselModule,
    CountUpModule
  ],
  schemas:[CUSTOM_ELEMENTS_SCHEMA],
  exports: [BreadcrumbsComponent, ClientLogoComponent, ServicesComponent, FaqsComponent, CounterComponent, WorkProcessComponent, ContactComponent, FooterComponent,
    ScrollspyDirective, LandingScrollspyDirective]
})
export class SharedModule { }
```

- [ ] **Step 3: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0. No `Cannot find module` errors for any NFT or Job component.

- [ ] **Step 4: Commit**

```bash
git add -u src/app/shared/landing/ src/app/landing/
git add src/app/shared/shared.module.ts
git commit -m "feat(cleanup): Batch 2B — delete dead landing sections (NFT 6, Job 6, profile)"
```

---

### Task 3 — Batch 2C: Delete dead widget subdirs and update `widget.module.ts`

**Files:**
- Delete: `src/app/shared/widget/crm/` (4 components: CrmStatComponent, DealsStatusComponent, UpcomingActivitiesComponent, ClosingDealsComponent)
- Delete: `src/app/shared/widget/crypto/` (4 components: CryptoStatComponent, CurrenciesComponent, TopPerformersComponent, NewsFeedComponent)
- Delete: `src/app/shared/widget/nft/` (1 component: NftStatComponent)
- Delete: `src/app/shared/widget/projects/` (4 components: ProjectsStatComponent, ActiveProjectComponent, MyTaskComponent, TeamMembersComponent)
- Delete: `src/app/shared/widget/analytics/analatics-stat/` (AnalaticsStatComponent)
- Delete: `src/app/shared/widget/analytics/top-pages/` (TopPagesComponent)
- Modify: `src/app/shared/widget/widget.module.ts`
- Keep: `src/app/shared/widget/dashboard/` (BestSellingComponent, TopSellingComponent, RecentOrdersComponent, StatComponent — all live)

- [ ] **Step 1: Delete the dead widget directories**

```bash
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/crm"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/crypto"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/nft"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/projects"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/analytics/analatics-stat"
rm -rf "C:/Projets/Smell_Wear/src/app/shared/widget/analytics/top-pages"
```

- [ ] **Step 2: Rewrite `widget.module.ts` to keep only live dashboard widgets**

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgbTooltipModule, NgbProgressbarModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { CountUpModule } from 'ngx-countup';
// Feather Icon
import { FeatherModule } from 'angular-feather';
import { allIcons } from 'angular-feather/icons';
// Apex Chart Package
import { NgApexchartsModule } from 'ng-apexcharts';

import { BestSellingComponent } from './dashboard/best-selling/best-selling.component';
import { TopSellingComponent } from './dashboard/top-selling/top-selling.component';
import { RecentOrdersComponent } from './dashboard/recent-orders/recent-orders.component';
import { StatComponent } from './dashboard/stat/stat.component';

@NgModule({
  declarations: [
    BestSellingComponent,
    TopSellingComponent,
    RecentOrdersComponent,
    StatComponent,
  ],
  imports: [
    CommonModule,
    NgbTooltipModule,
    NgbProgressbarModule,
    NgbDropdownModule,
    CountUpModule,
    FeatherModule.pick(allIcons),
    NgApexchartsModule,
  ],
  exports: [BestSellingComponent, TopSellingComponent, RecentOrdersComponent, StatComponent]
})
export class WidgetModule { }
```

- [ ] **Step 3: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0. No dead widget import errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/app/shared/widget/
git add src/app/shared/widget/widget.module.ts
git commit -m "feat(cleanup): Batch 2C — delete dead CRM/Crypto/NFT/Projects/Analytics widgets"
```

---

## Chunk 2: Batches 2D–2F (layouts, NgRx store, orphan files)

### Task 4 — Batch 2D: Delete `layouts/rightsidebar/` and update `layouts.module.ts`

**Files:**
- Modify: `src/app/layouts/vertical/vertical.component.html` (remove `<app-rightsidebar>` tag)
- Modify: `src/app/layouts/two-column/two-column.component.html` (remove `<app-rightsidebar>` tag)
- Modify: `src/app/layouts/horizontal/horizontal.component.html` (remove `<app-rightsidebar>` tag)
- Delete: `src/app/layouts/rightsidebar/` (entire directory)
- Modify: `src/app/layouts/layouts.module.ts` (remove RightsidebarComponent import + declaration)

Note: `onSettingsButtonClicked()` methods in the three layout TypeScript files call `document.body.classList.toggle('right-bar-enabled')` — they become unreachable dead code after the HTML tags are removed. Do NOT delete the methods (that is Phase 3 refactoring). Removing only the HTML tag is sufficient for the build to pass.

- [ ] **Step 1: Remove `<app-rightsidebar>` from `vertical.component.html`**

In `src/app/layouts/vertical/vertical.component.html`, remove line 18:
```html
<app-rightsidebar (settingsButtonClicked)="onSettingsButtonClicked()"></app-rightsidebar>
```

- [ ] **Step 2: Remove `<app-rightsidebar>` from `two-column.component.html`**

In `src/app/layouts/two-column/two-column.component.html`, remove line 24:
```html
<app-rightsidebar (settingsButtonClicked)="onSettingsButtonClicked()"></app-rightsidebar>
```

- [ ] **Step 3: Remove `<app-rightsidebar>` from `horizontal.component.html`**

In `src/app/layouts/horizontal/horizontal.component.html`, remove line 19:
```html
  <app-rightsidebar  (settingsButtonClicked)="onSettingsButtonClicked()"></app-rightsidebar>
```

- [ ] **Step 4: Delete the rightsidebar directory**

```bash
rm -rf "C:/Projets/Smell_Wear/src/app/layouts/rightsidebar"
```

- [ ] **Step 5: Update `layouts.module.ts` to remove `RightsidebarComponent`**

Remove the import line at the top:
```typescript
import { RightsidebarComponent } from './rightsidebar/rightsidebar.component';
```

Remove `RightsidebarComponent,` from the `declarations` array. The declarations array should become:

```typescript
    declarations: [
        LayoutComponent,
        VerticalComponent,
        TopbarComponent,
        SidebarComponent,
        FooterComponent,
        HorizontalComponent,
        HorizontalTopbarComponent,
        TwoColumnComponent,
        TwoColumnSidebarComponent,

    ],
```

- [ ] **Step 6: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0. No `Cannot find module './rightsidebar/rightsidebar.component'` error and no "unknown element: app-rightsidebar" error.

- [ ] **Step 7: Commit**

```bash
git add src/app/layouts/vertical/vertical.component.html
git add src/app/layouts/two-column/two-column.component.html
git add src/app/layouts/horizontal/horizontal.component.html
git add src/app/layouts/layouts.module.ts
git add -u src/app/layouts/
git commit -m "feat(cleanup): Batch 2D — delete layouts/rightsidebar, remove template usages"
```

---

### Task 5 — Batch 2E: Remove 10 dead NgRx store slices

**Files:**
- Modify: `src/app/app.module.ts` (remove 10 dead Effect imports + EffectsModule entries)
- Modify: `src/app/store/index.ts` (remove 10 dead reducer imports + state/reducer entries)
- Delete: `src/app/store/Project/`
- Delete: `src/app/store/Task/`
- Delete: `src/app/store/CRM/`
- Delete: `src/app/store/Crypto/`
- Delete: `src/app/store/Invoice/`
- Delete: `src/app/store/Ticket/`
- Delete: `src/app/store/File Manager/`
- Delete: `src/app/store/Todo/`
- Delete: `src/app/store/Jobs/`
- Delete: `src/app/store/APIKey/`
- Keep: `src/app/store/Authentication/`, `src/app/store/Ecommerce/`, `src/app/store/layouts/`

- [ ] **Step 1: Rewrite `app.module.ts` to remove the 10 dead Effects**

Remove these 10 import lines (keep `AuthenticationEffects` and `EcommerceEffects`):
```typescript
import { ProjectEffects } from './store/Project/project_effect';
import { TaskEffects } from './store/Task/task_effect';
import { CRMEffects } from './store/CRM/crm_effect';
import { CryptoEffects } from './store/Crypto/crypto_effect';
import { InvoiceEffects } from './store/Invoice/invoice_effect';
import { TicketEffects } from './store/Ticket/ticket_effect';
import { FileManagerEffects } from './store/File Manager/filemanager_effect';
import { TodoEffects } from './store/Todo/todo_effect';
import { ApplicationEffects } from './store/Jobs/jobs_effect';
import { ApikeyEffects } from './store/APIKey/apikey_effect';
```

The Store-related import block should become (the rest of the file is unchanged):
```typescript
// Store
import { rootReducer } from './store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';
import { EcommerceEffects } from './store/Ecommerce/ecommerce_effect';
import { AuthenticationEffects } from './store/Authentication/authentication.effects';
```

The `EffectsModule.forRoot([...])` block should become:
```typescript
        EffectsModule.forRoot([
            AuthenticationEffects,
            EcommerceEffects,
        ]),
```

- [ ] **Step 2: Rewrite `store/index.ts` to remove the 10 dead slices**

Note: The `Authentication` reducer is already commented out in the current `store/index.ts`. It is intentionally absent from the rewrite below. The `store/Authentication/` directory is **not** deleted — it is kept because `AuthenticationEffects` is wired in `app.module.ts`.

The file should become:

```typescript
import { ActionReducerMap } from "@ngrx/store";
import { LayoutState, layoutReducer } from "./layouts/layout-reducers";
import { EcommerceState, ecommercerReducer } from "./Ecommerce/ecommerce_reducer";

export interface RootReducerState {
    layout: LayoutState;
    Ecommerce: EcommerceState;
}

export const rootReducer: ActionReducerMap<RootReducerState> = {
    layout: layoutReducer,
    Ecommerce: ecommercerReducer,
}
```

- [ ] **Step 3: Delete the 10 dead store directories**

```bash
rm -rf "C:/Projets/Smell_Wear/src/app/store/Project"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Task"
rm -rf "C:/Projets/Smell_Wear/src/app/store/CRM"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Crypto"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Invoice"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Ticket"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Todo"
rm -rf "C:/Projets/Smell_Wear/src/app/store/Jobs"
rm -rf "C:/Projets/Smell_Wear/src/app/store/APIKey"
rm -rf "C:/Projets/Smell_Wear/src/app/store/File Manager"
```

- [ ] **Step 4: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0. No `Cannot find module` for any deleted store path.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.module.ts src/app/store/index.ts
git add -u src/app/store/
git commit -m "feat(cleanup): Batch 2E — remove 10 dead NgRx store slices (CRM, Crypto, Invoice, Jobs, Project, Task, Ticket, Todo, FileManager, APIKey)"
```

---

### Task 6 — Batch 2F: Delete orphan files and move `request.sql`

**Files:**
- Delete: `src/app/app-routing.module.ts~` (editor backup file — if it exists)
- Delete: `src/typings.d.ts` (dead template typings — if it exists)
- Delete: `src/app/typings.d.ts` (dead template typings — if it exists)
- Move: `src/app/core/models/request.sql` → `docs/sql/request.sql`

- [ ] **Step 1: Check which files exist**

```bash
ls "C:/Projets/Smell_Wear/src/app/app-routing.module.ts~" 2>/dev/null && echo "EXISTS" || echo "not found"
ls "C:/Projets/Smell_Wear/src/typings.d.ts" 2>/dev/null && echo "EXISTS" || echo "not found"
ls "C:/Projets/Smell_Wear/src/app/typings.d.ts" 2>/dev/null && echo "EXISTS" || echo "not found"
ls "C:/Projets/Smell_Wear/src/app/core/models/request.sql" 2>/dev/null && echo "EXISTS" || echo "not found"
```

- [ ] **Step 2: Delete orphan files found in Step 1**

```bash
rm -f "C:/Projets/Smell_Wear/src/app/app-routing.module.ts~"
rm -f "C:/Projets/Smell_Wear/src/typings.d.ts"
rm -f "C:/Projets/Smell_Wear/src/app/typings.d.ts"
```

Skip any file that Step 1 reported as "not found".

- [ ] **Step 3: Move `request.sql` to `docs/sql/` (if it exists)**

```bash
mkdir -p "C:/Projets/Smell_Wear/docs/sql"
mv "C:/Projets/Smell_Wear/src/app/core/models/request.sql" "C:/Projets/Smell_Wear/docs/sql/request.sql"
```

Skip if Step 1 reported it as "not found".

- [ ] **Step 4: Build to verify**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0. The deleted `typings.d.ts` files are declaration-only; if the build references them, it will fail here with a clear error indicating which file needs the declaration.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/ src/
git add -A docs/sql/
git commit -m "feat(cleanup): Batch 2F — delete orphan backup/typings files, move request.sql to docs/sql"
```

---

## Final Verification

After all 6 batches complete:

- [ ] **Full production build passes**

```bash
cd C:/Projets/Smell_Wear && ng build --configuration production 2>&1 | tail -20
```

Expected: exit code 0.

- [ ] **No references to deleted store slices remain**

```bash
grep -r "ProjectEffects\|TaskEffects\|CRMEffects\|CryptoEffects\|InvoiceEffects\|TicketEffects\|FileManagerEffects\|TodoEffects\|ApplicationEffects\|ApikeyEffects" "C:/Projets/Smell_Wear/src" --include="*.ts"
```
Expected: no output.

- [ ] **No references to deleted widget components remain**

```bash
grep -r "NftStatComponent\|CrmStatComponent\|CryptoStatComponent\|ProjectsStatComponent\|TopPagesComponent\|AnalaticsStatComponent" "C:/Projets/Smell_Wear/src" --include="*.ts"
```
Expected: no output.

- [ ] **No references to deleted landing components remain**

```bash
grep -r "MarketPlaceComponent\|WalletComponent\|FeaturesComponent\|CategoriesComponent\|DiscoverComponent\|TopCreatorComponent\|ProcessComponent\|FindjobsComponent\|CandidatesComponent\|BlogComponent\|JobcategoriesComponent\|JobFooterComponent" "C:/Projets/Smell_Wear/src" --include="*.ts"
```
Expected: no output.

- [ ] **No references to RightsidebarComponent or app-rightsidebar remain**

```bash
grep -r "RightsidebarComponent\|rightsidebar" "C:/Projets/Smell_Wear/src" --include="*.ts"
grep -r "app-rightsidebar" "C:/Projets/Smell_Wear/src" --include="*.html"
```
Expected: no output for either command. The `onSettingsButtonClicked()` methods in vertical/two-column/horizontal components may remain as unreferenced dead methods — they do not affect the build and are Phase 3 cleanup.

- [ ] **No references to AppsModule or deleted chart/shared-modules remain**

```bash
grep -r "AppsModule\|apps/apps.module\|ChartsModule\|charts.module\|shared-modules\|feather-icons.module" "C:/Projets/Smell_Wear/src" --include="*.ts"
```
Expected: no output.
