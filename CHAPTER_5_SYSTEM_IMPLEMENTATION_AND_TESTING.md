# CHAPTER FIVE: SYSTEM IMPLEMENTATION AND TESTING

## 5.1 Introduction

This chapter presents the implementation and testing of `Creatuno` as the practical realization of the design decisions in Chapter 4 and the methodological commitments in Chapter 3. In line with the Design Science Research and mixed-method orientation, the chapter documents:

- how requirements were translated into system modules;
- how the platform was iteratively constructed;
- how functionality and practical suitability were evaluated;
- how observed outcomes map to the study objectives and research questions.

---

## 5.2 Programming Tools and Technologies

### 5.2.1 Core Development Stack

- **Application framework:** Next.js (App Router based full-stack web architecture).
- **Language:** TypeScript.
- **Frontend:** React + Tailwind CSS.
- **Database and storage:** Supabase PostgreSQL + Supabase Storage.
- **Authentication:** Clerk.
- **Payments:** Monime API integration and webhook callback processing.
- **Offline subsystem:** `next-pwa`, service worker, IndexedDB queue, sync manager.

### 5.2.2 Supporting Engineering Libraries

- form and validation tools (`react-hook-form`, `zod`);
- UI feedback and component support libraries;
- linting and static quality checks via ESLint.

### 5.2.3 Build and Runtime Tooling

- npm scripts for development, build, start, and linting;
- SQL migration files used for schema evolution and reproducible database setup;
- utility scripts for webhook registration/testing and build log capture.

---

## 5.3 Implementation Strategy

The implementation strategy follows the Chapter 3 tri-phase logic:

1. **Requirements-informed design phase**  
   Problem clusters and feature priorities from the research context were mapped to system modules and entities.

2. **Iterative construction phase**  
   The platform was developed in modular domains (portfolio, opportunities, mentorship, pitch/payment, offline sync), allowing incremental enhancement without breaking architectural cohesion.

3. **Evaluation-oriented phase**  
   Core workflows were validated through functional and integration-style checks, with particular attention to low-bandwidth resilience and security controls.

### 5.3.1 Objective-Driven Implementation Traceability

| Study Objective | Implemented System Features | Implementation Evidence | Implementation Status |
|---|---|---|---|
| Objective 1: stakeholder-informed requirements | Multi-module architecture reflecting portfolio, mentorship, opportunities, funding, and offline concerns | Domain-specific API routes and mapped UI workflows | Achieved |
| Objective 2: mobile-first low-bandwidth PWA | Service worker caching, offline queue, sync API endpoint | PWA configuration and sync pipeline behavior | Achieved |
| Objective 3: portfolio management | Portfolio/project CRUD and public portfolio discovery | Portfolio and project APIs with public visibility flow | Achieved |
| Objective 4: mentorship framework | Mentorship requests/offers plus messaging and notifications | Mentorship and message modules integrated in app/API | Achieved (pilot-scale) |
| Objective 5: employment and investment linkage | Opportunity board, applications, pitch-investor interest, payment flows | Opportunities/applications and payment-enabled pitch workflows | Achieved (with further hardening recommended) |

---

## 5.4 System Implementation by Module

### 5.4.1 Authentication and Access Control Module

Implementation includes:

- public and protected route control through middleware;
- user session checks in API handlers for protected operations;
- unauthorized API access response handling for secure behavior.

**Outcome relevance:** directly supports trust, policy control, and role-safe interactions.

### 5.4.2 Portfolio and Project Management Module

Implementation includes:

- creation, update, retrieval, and public presentation of portfolios;
- project management under portfolio ownership;
- structured profile visibility beyond transient social feeds.

**Outcome relevance:** addresses the market visibility challenge identified in Chapter 1.3.

### 5.4.3 Opportunities and Applications Module

Implementation includes:

- opportunities listing and posting workflows;
- application submission and retrieval paths;
- domain-level data persistence and status-driven interactions.

**Outcome relevance:** improves pathway from creative talent to paid opportunities.

### 5.4.4 Mentorship and Messaging Module

Implementation includes:

- mentorship request and offer workflows;
- mentor-mentee communication channels;
- related notification support for interaction continuity.

**Outcome relevance:** formalizes previously ad hoc mentorship processes.

### 5.4.5 Pitch, Investment, and Payment Module

Implementation includes:

- pitch creation and investor-interest flow;
- payment checkout initiation and callback handling;
- transaction and investment history records.

**Outcome relevance:** establishes structured funding pathways that were previously weak or informal.

### 5.4.6 Offline-First and Synchronization Module

Implementation includes:

- local operation queue using IndexedDB;
- deferred synchronization through dedicated sync endpoint;
- conflict-aware update handling based on server timestamps.

**Outcome relevance:** addresses connectivity and data-cost constraints central to the Sierra Leone context.

---

## 5.5 Database and Data Model Implementation

### 5.5.1 Schema Delivery Approach

- initial schema migration introduced core platform entities;
- subsequent migrations added enhanced features (messages, feedback, work submissions, pitch and investment structures, delivery/payment support);
- relationships are defined through foreign keys and normalized entity structures.

### 5.5.2 Data Integrity and Lifecycle

- entity ownership and relationship links enforce contextual correctness;
- transaction and notification entities support workflow observability;
- migration-driven evolution supports controlled feature expansion over time.

---

## 5.6 Security and Reliability Implementation

### 5.6.1 Security Controls

- route-level and API-level authentication checks;
- protected operations tied to authenticated user context;
- payment webhook verification and guarded callback handling.

### 5.6.2 Reliability Controls

- offline queue prevents immediate data loss under network interruptions;
- synchronization endpoint validates request structure before persistence;
- explicit response handling supports retry or error visibility.

---

## 5.7 System Testing

### 5.7.1 Testing Approach and Scope

In alignment with Chapter 3 evaluation orientation, testing focused on:

- functional correctness of core business workflows;
- integration behavior for payments and synchronization;
- security behavior for unauthorized access;
- practical resilience for intermittent connectivity scenarios.

### 5.7.2 Test Environment

- local development runtime with configured service integrations;
- browser-based testing for desktop/mobile behavior and PWA flow;
- Supabase-backed schema with migration-applied entities;
- webhook simulation/testing scripts for payment callbacks.

### 5.7.3 Test Case Matrix and Results

| Test ID | Test Category | Scenario | Preconditions | Expected Result | Observed Result | Status |
|---|---|---|---|---|---|---|
| TC-01 | Access control | Unauthenticated request to protected route | User not logged in | Redirect or unauthorized response | Access blocked as designed | Pass |
| TC-02 | Portfolio functional | Create new portfolio entry | Authenticated user session | Portfolio persisted and retrievable | Portfolio created and listed | Pass |
| TC-03 | Public discoverability | Access public portfolio URL | Portfolio is marked public | Public visibility without forced login | Public page served correctly | Pass |
| TC-04 | Opportunities functional | Post new opportunity | Authorized poster context | Opportunity record created and listed | Listing appears in opportunity flow | Pass |
| TC-05 | Applications functional | Submit application to listed opportunity | Valid opportunity and user | Application linked and stored | Application record available | Pass |
| TC-06 | Mentorship workflow | Send mentorship request | Authenticated requester | Request saved with initial status | Request persisted and visible | Pass |
| TC-07 | Offline resilience | Create/update while offline, then reconnect | Offline mode simulated | Queue item saved and later synced | Sync endpoint applied queued changes | Pass |
| TC-08 | Payment integration | Initiate pitch checkout | Valid pitch and amount context | Checkout session generated | Session generated and redirect path available | Pass |
| TC-09 | Webhook integration | Simulate payment webhook callback | Valid callback payload/signature flow | Investment/transaction state updated | Records updated via callback handling | Pass |
| TC-10 | API security | Call protected API without auth | Missing auth context | 401-style denial behavior | Unauthorized response returned | Pass |

### 5.7.4 Evaluation Interpretation Against Research Questions

| Research Question (Chapter 1.5) | Evidence from Implementation and Testing | Interpretation |
|---|---|---|
| RQ1: key digital/professional challenges | End-to-end modules implemented around identified constraints | Design and build directly reflect documented challenge clusters |
| RQ2: required functionality/usability | Core workflows tested and operational in integrated form | Minimum viable professional ecosystem achieved |
| RQ3: PWA suitability in low-bandwidth context | Offline queue and sync tests passed | PWA approach is technically suitable for intermittent connectivity |
| RQ4: improvement in portfolio/mentorship/networking capability | Portfolio, mentorship, messaging, and opportunity workflows functional | Platform provides practical capability improvement pathways |
| RQ5: perceived usability/value | Early evidence through structured functionality and flow completion | Strong baseline established; expanded user perception study recommended |

---

## 5.8 Screenshots of the System

For dissertation submission, include figure evidence for:

1. landing page and navigation;
2. authentication pages;
3. dashboard overview;
4. portfolio create/edit/public pages;
5. opportunities listing, detail, and application journey;
6. mentorship request and messaging interfaces;
7. pitch detail, investor action, and payment state pages;
8. notifications and user activity states;
9. offline indicator plus post-reconnect sync confirmation.

### 5.8.1 Screenshot Documentation Standard

- include figure numbering and captions;
- use consistent sequence by user journey;
- redact private data and secret tokens;
- include both success and validation/error states where academically useful.

---

## 5.9 Limitations of Current Implementation and Evaluation

Consistent with Chapter 1.8 and Chapter 3 constraints:

- evaluation remains pilot-oriented, not nationally representative;
- automated test depth is still limited compared to mature production systems;
- long-term economic impact and retention effects require longitudinal follow-up;
- mentorship outcomes depend on sustained mentor participation and ecosystem partnerships.

---

## 5.10 Chapter Summary

This chapter documented how `Creatuno` was implemented as a requirements-driven, modular, and context-sensitive platform. It provided objective-to-feature traceability, module-level implementation depth, and test evidence linked to the research questions. The implementation demonstrates practical viability of an integrated low-bandwidth professional platform, forming the basis for final findings and conclusions in Chapter 6.

