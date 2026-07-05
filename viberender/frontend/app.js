document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const promptInput = document.getElementById("prompt-input");
    const renderBtn = document.getElementById("render-btn");
    const fovSlider = document.getElementById("camera-fov");
    const fovVal = document.getElementById("fov-val");
    const lightSlider = document.getElementById("light-power");
    const lightVal = document.getElementById("light-val");
    
    const viewportPlaceholder = document.getElementById("viewport-placeholder");
    const viewportImage = document.getElementById("viewport-image");
    const loadingSpinner = document.getElementById("loading-spinner");
    const viewportStats = document.getElementById("viewport-stats");
    
    const codeContent = document.getElementById("code-content");
    const treeContent = document.getElementById("tree-content");
    const copyBtn = document.getElementById("copy-btn");
    
    const runEvalBtn = document.getElementById("run-eval-btn");
    const evalContent = document.getElementById("eval-content");

    // Slider Listeners
    fovSlider.addEventListener("input", (e) => {
        fovVal.textContent = `${e.target.value}°`;
    });
    
    lightSlider.addEventListener("input", (e) => {
        lightVal.textContent = `${e.target.value}W`;
    });

    // Tab Switching Logic
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });

    // Preset Prompt Tags
    const presetTags = document.querySelectorAll(".preset-tag");
    presetTags.forEach(tag => {
        tag.addEventListener("click", () => {
            promptInput.value = tag.dataset.prompt;
        });
    });

    // Copy Script Code
    copyBtn.addEventListener("click", () => {
        const text = codeContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = "Copied!";
            copyBtn.style.background = "#00f2fe";
            copyBtn.style.color = "#000";
            
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.background = "";
                copyBtn.style.color = "";
            }, 1500);
        });
    });

    // Main Generate & Render handler
    renderBtn.addEventListener("click", async () => {
        const query = promptInput.value.trim();
        if (!query) {
            alert("Please enter a scene description first!");
            return;
        }

        // Show loader spinner
        loadingSpinner.classList.remove("hidden");
        viewportPlaceholder.classList.add("hidden");
        viewportImage.classList.add("hidden");
        viewportStats.textContent = "Processing...";

        try {
            const response = await fetch(`/api/viberender/generate?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error("Generation request failed");
            }
            
            const data = await response.json();
            
            // Hide spinner and display render image
            loadingSpinner.classList.add("hidden");
            viewportImage.src = data.render_image;
            viewportImage.classList.remove("hidden");
            
            // Update stats overlay
            viewportStats.textContent = "1920x1080 | Cycles Renderer | Samples: 128";
            
            // Update script tab
            codeContent.textContent = data.blender_script;
            
            // Populate Scene Tree Hierarchy
            populateSceneTree(data.scene_tree);
            
        } catch (error) {
            loadingSpinner.classList.add("hidden");
            viewportPlaceholder.classList.remove("hidden");
            viewportStats.textContent = "Error";
            alert(`Error: ${error.message}`);
        }
    });

    // Populate Scene Tree View helper
    function populateSceneTree(tree) {
        treeContent.innerHTML = "";
        
        // Add camera node
        const cam = tree.camera;
        treeContent.appendChild(createTreeNode(cam.name, cam.type, "🎥", "node-camera"));
        
        // Add meshes
        tree.objects.forEach(obj => {
            treeContent.appendChild(createTreeNode(obj.name, `${obj.type} (${obj.material})`, "📦", "node-mesh"));
        });
        
        // Add lights
        tree.lights.forEach(light => {
            treeContent.appendChild(createTreeNode(light.name, `${light.type} (${light.energy})`, "💡", "node-light"));
        });
    }

    function createTreeNode(name, type, icon, customClass) {
        const el = document.createElement("div");
        el.className = `tree-node ${customClass || ""}`;
        el.innerHTML = `
            <span class="node-icon">${icon}</span>
            <span class="node-name">${name}</span>
            <span class="node-type">${type}</span>
        `;
        return el;
    }

    // Run Automated Scorecard Validation
    runEvalBtn.addEventListener("click", async () => {
        runEvalBtn.innerText = "Evaluating...";
        runEvalBtn.disabled = true;
        
        try {
            const res = await fetch("/api/viberender/eval");
            const data = await res.json();
            
            runEvalBtn.innerText = "Run EDD Validation";
            runEvalBtn.disabled = false;
            
            renderScorecard(data);
        } catch (error) {
            runEvalBtn.innerText = "Run EDD Validation";
            runEvalBtn.disabled = false;
            alert("Failed to execute trajectory evaluations.");
        }
    });

    // Render evaluation results dynamically
    function renderScorecard(report) {
        let html = `
            <div class="scorecard-summary">
                <p style="font-size:0.85rem; margin-bottom:0.8rem; font-weight:600; color:#00f2fe;">
                    Report: ${report.passed_tests}/${report.total_tests} Tests Passed (${report.timestamp})
                </p>
                
                ${createMetricCard("Trigger Accuracy", report.scorecard.trigger_accuracy)}
                ${createMetricCard("Trajectory Completeness", report.scorecard.trajectory_completeness)}
                ${createMetricCard("Execution Quality", report.scorecard.execution_quality)}
            </div>
            <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
                <h4 style="font-size:0.8rem; text-transform:uppercase; color:#a1a1aa; margin-bottom:0.5rem;">Case Traces:</h4>
        `;
        
        report.results.forEach(caseRes => {
            const statusCol = caseRes.status === "PASSED" ? "#48d158" : "#ff4555";
            html += `
                <div style="background:rgba(255,255,255,0.02); padding:0.6rem; border-radius:4px; margin-bottom:0.5rem; border-left: 2px solid ${statusCol}; font-size:0.75rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:600;">
                        <span>${caseRes.name}</span>
                        <span style="color:${statusCol};">${caseRes.status}</span>
                    </div>
                    <div style="color:#a1a1aa; margin-top:0.25rem;">
                        Query: "${caseRes.query}"
                    </div>
                    <div style="font-family:monospace; margin-top:0.25rem; font-size:0.7rem; color:#bf5af2;">
                        Trace: ${caseRes.actual_trajectory.join(" -> ")}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        evalContent.innerHTML = html;
    }

    function createMetricCard(label, val) {
        return `
            <div class="scorecard-metric-card" style="margin-bottom:0.6rem;">
                <div class="metric-row">
                    <span>${label}</span>
                    <span>${val}%</span>
                </div>
                <div class="metric-bar-bg">
                    <div class="metric-bar-fill" style="width: ${val}%;"></div>
                </div>
            </div>
        `;
    }
});
