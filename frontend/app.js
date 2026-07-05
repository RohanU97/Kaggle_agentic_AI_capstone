document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const searchForm = document.getElementById("search-form");
    const queryInput = document.getElementById("query-input");
    const welcomeState = document.getElementById("welcome-state");
    const loader = document.getElementById("loader");
    const loaderStatus = document.getElementById("loader-status");
    const resultsPanel = document.getElementById("results-panel");
    const evalModal = document.getElementById("eval-modal");
    const evalModalBody = document.getElementById("eval-modal-body");
    
    // Tab Elements
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = document.querySelectorAll(".tab-panel");
    
    // Trigger / Action Elements
    const searchBtn = document.getElementById("search-btn");
    const runEvalBtn = document.getElementById("run-eval-btn");
    const closeModalBtn = document.getElementById("close-modal-btn");
    
    // Result Target Elements
    const resolvedBadge = document.getElementById("resolved-query-badge");
    const synthesisContent = document.getElementById("synthesis-content");
    const profileRsid = document.getElementById("profile-rsid");
    const profileType = document.getElementById("profile-type");
    const profileChrom = document.getElementById("profile-chrom");
    const profilePos = document.getElementById("profile-pos");
    const profileAlleles = document.getElementById("profile-alleles");
    const profileSignificance = document.getElementById("profile-significance");
    const profilePhenotype = document.getElementById("profile-phenotype");
    const profileReview = document.getElementById("profile-review");
    const profileEvaluated = document.getElementById("profile-evaluated");
    const trialsCountBadge = document.getElementById("trials-count-badge");
    const trialsList = document.getElementById("trials-list");
    const fdaReactionsChart = document.getElementById("fda-reactions-chart");
    const trajectoryFlow = document.getElementById("trajectory-flow");

    // Simple Markdown to HTML parser
    function parseMarkdown(md) {
        if (!md) return "";
        let html = md;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Bullet points
        html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
        // Clean double nested lists
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        
        // Linebreaks
        html = html.replace(/\n\n/g, '<p></p>');
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
        });
    });

    // Example Links
    document.querySelectorAll(".example-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            queryInput.value = link.getAttribute("data-query");
            searchForm.dispatchEvent(new Event("submit"));
        });
    });

    // Form Submit search pipeline
    searchForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const query = queryInput.value.trim();
        if (!query) return;

        // Reset UI
        welcomeState.classList.add("hidden");
        resultsPanel.classList.add("hidden");
        loader.classList.remove("hidden");
        loaderStatus.innerText = "Agent parsing query & routing to database sub-pipelines...";

        // Set loader progress updates
        const progressSteps = [
            "Connecting to dbSNP for coordinate mapping & RefSNP registration...",
            "Querying ClinVar database for clinical ground truth & pathogenicity...",
            "Searching ClinicalTrials.gov API for active therapeutic trials...",
            "Invoking OpenFDA endpoint to aggregate safety signals & adverse events...",
            "Assembling research data & generating memo using Gemini..."
        ];
        
        let stepIdx = 0;
        const progressInterval = setInterval(() => {
            if (stepIdx < progressSteps.length) {
                loaderStatus.innerText = progressSteps[stepIdx];
                stepIdx++;
            }
        }, 1500);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error("Search pipeline failed");
            
            const data = await response.json();
            clearInterval(progressInterval);
            loader.classList.add("hidden");
            
            // Populating results
            renderResults(data);
        } catch (err) {
            clearInterval(progressInterval);
            loader.classList.add("hidden");
            alert(`Error: ${err.message}. Ensure the python backend server is running.`);
            welcomeState.classList.remove("hidden");
        }
    });

    // Render results in dashboard
    function renderResults(data) {
        resultsPanel.classList.remove("hidden");
        
        // Reset tabs to synthesis active
        tabBtns.forEach(btn => btn.classList.remove("active"));
        tabPanels.forEach(panel => panel.classList.remove("active"));
        tabBtns[0].classList.add("active");
        document.getElementById("synthesis-tab").classList.add("active");

        // 1. Badge & synthesis
        resolvedBadge.innerText = data.resolved_query;
        synthesisContent.innerHTML = parseMarkdown(data.clinical_synthesis);

        // 2. dbSNP Details
        const details = data.variant_details || {};
        profileRsid.innerText = details.refsnp_id || data.resolved_query;
        profileType.innerText = details.variant_type || "N/A";
        
        const placement = details.placements ? details.placements[0] : null;
        if (placement && placement.alleles && placement.alleles[0]) {
            profileChrom.innerText = placement.seq_id || "N/A";
            profilePos.innerText = placement.alleles[0].position || "N/A";
            profileAlleles.innerText = `${placement.alleles[0].ref} > ${placement.alleles[0].alt}`;
        } else {
            profileChrom.innerText = details.chrom || "N/A";
            profilePos.innerText = details.pos || "N/A";
            profileAlleles.innerText = (details.ref && details.alt) ? `${details.ref} > ${details.alt}` : "N/A";
        }

        // 3. ClinVar Details
        const clinvar = data.clinvar_details && data.clinvar_details.length ? data.clinvar_details[0] : null;
        if (clinvar) {
            profileSignificance.innerHTML = `<span class="badge ${getSignificanceClass(clinvar.clinical_significance)}">${clinvar.clinical_significance}</span>`;
            profilePhenotype.innerText = clinvar.phenotypes ? clinvar.phenotypes.join(", ") : "N/A";
            profileReview.innerText = clinvar.review_status || "N/A";
            profileEvaluated.innerText = clinvar.last_evaluated || "N/A";
        } else {
            profileSignificance.innerText = "No ClinVar assertion found";
            profilePhenotype.innerText = "N/A";
            profileReview.innerText = "N/A";
            profileEvaluated.innerText = "N/A";
        }

        // 4. Clinical Trials
        const trials = data.matched_clinical_trials || {};
        const count = trials.totalCount || 0;
        trialsCountBadge.innerText = `${count} matched`;
        
        trialsList.innerHTML = "";
        const studies = trials.studies || [];
        if (studies.length) {
            studies.forEach(study => {
                const proto = study.protocolSection || {};
                const ident = proto.identificationModule || {};
                const status = proto.statusModule || {};
                const desc = proto.descriptionModule || {};
                
                const card = document.createElement("div");
                card.className = "trial-card";
                card.innerHTML = `
                    <div class="trial-header">
                        <span class="trial-nct">${ident.nctId}</span>
                        <span class="trial-phase">${proto.armsInterventionsModule ? "Interventional" : "Observational"}</span>
                    </div>
                    <div class="trial-title">${ident.briefTitle || "Untitled Study"}</div>
                    <div class="trial-summary">${desc.briefSummary || "No summary provided."}</div>
                `;
                trialsList.appendChild(card);
            });
        } else {
            trialsList.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No active clinical trials matched for this genomic target.</div>`;
        }

        // 5. OpenFDA Charts
        const fda = data.drug_safety_warnings || {};
        const results = fda.results || [];
        fdaReactionsChart.innerHTML = "";
        
        if (results.length) {
            const maxCount = Math.max(...results.map(r => r.count));
            results.forEach(item => {
                const pct = (item.count / maxCount) * 100;
                const row = document.createElement("div");
                row.className = "chart-bar-row";
                row.innerHTML = `
                    <div class="chart-bar-labels">
                        <span>${item.term}</span>
                        <strong>${item.count}</strong>
                    </div>
                    <div class="chart-bar-bg">
                        <div class="chart-bar-fill" style="width: ${pct}%"></div>
                    </div>
                `;
                fdaReactionsChart.appendChild(row);
            });
        } else {
            fdaReactionsChart.innerHTML = `<div class="text-center text-muted" style="padding: 2rem;">No adverse reaction warnings reported for this target.</div>`;
        }

        // 6. Agent Trajectory Flow
        const traj = data.trajectory || [];
        trajectoryFlow.innerHTML = "";
        if (traj.length) {
            traj.forEach((step, index) => {
                const stepCard = document.createElement("div");
                stepCard.className = "step-card";
                
                let iconClass = "fa-solid fa-gears";
                if (step.includes("dbsnp")) iconClass = "fa-solid fa-dna text-teal";
                if (step.includes("clinvar")) iconClass = "fa-solid fa-notes-medical text-magenta";
                if (step.includes("clinical-trials")) iconClass = "fa-solid fa-microscope text-blue";
                if (step.includes("openfda")) iconClass = "fa-solid fa-triangle-exclamation text-yellow";

                stepCard.innerHTML = `<i class="${iconClass}"></i><span>${step}</span>`;
                trajectoryFlow.appendChild(stepCard);
                
                if (index < traj.length - 1) {
                    const arrow = document.createElement("div");
                    arrow.className = "step-arrow";
                    arrow.innerHTML = `<i class="fa-solid fa-arrow-right"></i>`;
                    trajectoryFlow.appendChild(arrow);
                }
            });
        } else {
            trajectoryFlow.innerHTML = `<div class="text-center text-muted">No database sub-pipelines executed.</div>`;
        }
    }

    // Helper for significance styling
    function getSignificanceClass(sig) {
        if (!sig) return "";
        const s = sig.toLowerCase();
        if (s.includes("pathogenic")) return "badge-purple";
        if (s.includes("benign")) return "badge-teal";
        if (s.includes("uncertain") || s.includes("vus")) return "badge-yellow";
        return "badge-blue";
    }

    // Modal Control for EDD
    runEvalBtn.addEventListener("click", async () => {
        evalModal.classList.remove("hidden");
        evalModalBody.innerHTML = `
            <div class="text-center" style="padding: 3rem;">
                <i class="fa-solid fa-spinner fa-spin text-purple" style="font-size: 3rem;"></i>
                <p style="margin-top: 1.5rem; color: var(--text-muted);">Running automated glass-box trajectory tests...</p>
            </div>
        `;

        try {
            const res = await fetch("/api/eval");
            if (!res.ok) throw new Error("Evaluation run failed");
            
            const data = await res.json();
            renderEvalScorecard(data);
        } catch (err) {
            evalModalBody.innerHTML = `
                <div class="alert-box alert-warning">
                    <i class="fa-solid fa-circle-xmark"></i>
                    <span>Failed to trigger test suite: ${err.message}</span>
                </div>
            `;
        }
    });

    closeModalBtn.addEventListener("click", () => {
        evalModal.classList.add("hidden");
    });

    window.addEventListener("click", (e) => {
        if (e.target === evalModal) {
            evalModal.classList.add("hidden");
        }
    });

    // Render EDD scorecard inside modal
    function renderEvalScorecard(data) {
        const passIcon = data.passed_tests === data.total_tests ? 
            '<span class="text-teal"><i class="fa-solid fa-circle-check"></i> ALL PASSED</span>' : 
            `<span class="text-yellow"><i class="fa-solid fa-triangle-exclamation"></i> ${data.passed_tests}/${data.total_tests} PASSED</span>`;

        let detailedHtml = "";
        data.detailed_results.forEach(res => {
            const statusIcon = res.trajectory_match && res.query_type_match ? 
                '<i class="fa-solid fa-circle-check text-teal"></i>' : 
                '<i class="fa-solid fa-circle-xmark text-magenta"></i>';
                
            detailedHtml += `
                <div class="trial-card" style="margin-top: 1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
                        <strong>${statusIcon} ${res.name}</strong>
                        <span class="trial-nct">${res.metrics.duration_seconds}s</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        <p>Query: "<em>${res.query}</em>" | Parser Match: ${res.query_type_match ? 'Yes' : 'No'}</p>
                        <p>Expected Trajectory: [ ${res.expected_trajectory.join(" -> ")} ]</p>
                        <p>Actual Trajectory: [ ${res.actual_trajectory.join(" -> ")} ]</p>
                    </div>
                </div>
            `;
        });

        evalModalBody.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                <div>
                    <strong>Total Tests:</strong> ${data.total_tests} | 
                    <strong>Status:</strong> ${passIcon}
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    Timestamp: ${data.timestamp}
                </div>
            </div>
            
            <div class="variant-grid" style="margin-bottom: 2rem;">
                <div class="card text-center" style="padding: 1.2rem; border-color: var(--purple);">
                    <div style="font-size: 2.2rem; font-weight:800; color: var(--purple);">${data.scorecard.trigger_accuracy}%</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Trigger Accuracy</div>
                </div>
                <div class="card text-center" style="padding: 1.2rem; border-color: var(--blue);">
                    <div style="font-size: 2.2rem; font-weight:800; color: var(--blue);">${data.scorecard.trajectory_completeness}%</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Trajectory Completeness</div>
                </div>
            </div>

            <h3>Detailed Results:</h3>
            ${detailedHtml}
        `;
    }
});
