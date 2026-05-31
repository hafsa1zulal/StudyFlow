let undoData = null;
let undoTimeout = null;
let taskChartInstance = null;

// XSS Koruması
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

// tüm başlangıç ayarları
document.addEventListener("DOMContentLoaded", function() {
    showSection("dashboard");
    loadSettings(); 
    loadTasks();

    // ENTER ile task ekleme
    document.getElementById("taskInput").addEventListener("keydown", function(event) {
        if(event.key === "Enter"){
            addTask();
        }
    });
});

function openModal(){
    document.getElementById("taskModal").style.display = "flex";
    setTimeout(() => {
        document.getElementById("taskInput").focus();
    }, 100);
}

function closeModal(){
    document.getElementById("taskModal").style.display = "none";
}

async function addTask(){
    let input = document.getElementById("taskInput");
    let taskValue = input.value.trim();

    if(taskValue === ""){
        alert("Task boş olamaz");
        return;
    }

    try {
        await fetch("/tasks", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({title: taskValue})
        });

        input.value = "";
        closeModal();
        loadTasks();
    } catch (error) {
        console.error("Görev eklenirken hata oluştu:", error);
    }
}

async function loadTasks(){
    try {
        let res = await fetch("/tasks");
        let data = await res.json();

        let taskList = document.getElementById("taskList");
        let htmlContent = ""; 
        let done = 0;

        data.forEach(task => {
            if(task.done === 1) done++;

            let safeTitle = escapeHTML(task.title);

            htmlContent += `
            <div class="task-item">
                <div>
                    <input type="checkbox" ${task.done ? "checked" : ""} onclick="toggleTask(${task.id})">
                    <span style="${task.done ? 'text-decoration:line-through;opacity:0.5' : ''}">
                        ${safeTitle}
                    </span>
                </div>
                <button onclick="deleteTask(${task.id}, '${safeTitle}')">X</button>
            </div>
            `;
            // Chart.js grafiğini güncelle
        let remaining = data.length - done;
        updateChart(done, remaining);

        // insight analysis
        let insightRate = document.getElementById("insightRate");
        let insightStatus = document.getElementById("insightStatus");
        let insightMessage = document.getElementById("insightMessage");

        if (data.length === 0) {
            insightRate.innerText = "0%";
            insightStatus.innerText = "No Tasks";
            insightStatus.style.color = "white";
            insightMessage.innerText = "Let's start measuring your productivity by adding your first task!";
        } else {
            let rate = Math.round((done / data.length) * 100);
            insightRate.innerText = rate + "%";
            
            if (rate === 100) {
                insightStatus.innerText = "Excellent! 🚀";
                insightStatus.style.color = "#22c55e"; 
                insightMessage.innerText = "You did a fantastic job! You completed all your tasks and achieved a flawless productivity rate.";
            } else if (rate == 50) {
                insightStatus.innerText = "On Track 👍";
                insightStatus.style.color = "#fbbf24"; 
                insightMessage.innerText = "You've completed half of your tasks. With this momentum, you can easily achieve your daily goals.";
            }
            else if (rate > 50) {
                insightStatus.innerText = "On Track 👍";
                insightStatus.style.color = "#fbbf24"; 
                insightMessage.innerText = "You've completed more than half of your tasks. With this momentum, you can easily achieve your daily goals.";
            }
            else {
                insightStatus.innerText = "Needs Focus 🎯";
                insightStatus.style.color = "#ef4444"; 
                insightMessage.innerText = "Starting out is always challenging. Focus on your pending tasks to quickly improve this rate.";
            }
        }
        });

        taskList.innerHTML = htmlContent;

        // istatistikleri güncelle
        document.getElementById("totalTasks").innerText = data.length;
        document.getElementById("doneTasks").innerText = done;
        document.getElementById("remainingTasks").innerText = data.length - done;

        // progress bar
        let percent = data.length === 0 ? 0 : Math.round((done / data.length) * 100);
        document.getElementById("progressFill").style.width = percent + "%";
        document.getElementById("progressText").innerText = percent + "% completed";

        // Chart.js grafiğini güncelle
        let remaining = data.length - done;
        updateChart(done, remaining);
        
    } catch (error) {
        console.error("Görevler yüklenirken hata oluştu:", error);
    }
}

async function deleteTask(id, title){
    await fetch(`/tasks/${id}`, {method:"DELETE"});
    undoData = {id, title};
    showUndoToast();
    loadTasks();
}

function showSection(name){

    document.querySelectorAll(".section").forEach(sec => {
        sec.classList.remove("active");
    });
    
    document.getElementById(name + "Section").classList.add("active");

    // add task butonu - sadece dashboard
    let addBtn = document.getElementById("addTaskBtn");
    if (addBtn) {
        if (name === "dashboard") {
            addBtn.style.display = "block"; 
        } else {
            addBtn.style.display = "none"; 
        }
    }
}

function showUndoToast(){
    let old = document.getElementById("undoToast");
    if(old) old.remove();

    let toast = document.createElement("div");
    toast.id = "undoToast";
    toast.innerHTML = `
        Task deleted — 
        <span onclick="undoDelete()" style="cursor:pointer;text-decoration:underline;">
            Undo
        </span>
    `;

    document.body.appendChild(toast);

    undoTimeout = setTimeout(() => {
        undoData = null;
        if(document.getElementById("undoToast")) {
            toast.remove();
        }
    }, 5000);
}

async function undoDelete(){
    if(!undoData) return;
    clearTimeout(undoTimeout);

    await fetch("/tasks", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title: undoData.title}) 
    });

    undoData = null;
    let toast = document.getElementById("undoToast");
    if(toast) toast.remove();

    loadTasks();
}

async function toggleTask(id){
    await fetch(`/tasks/${id}/toggle`, {method:"PUT"});
    loadTasks();
}

function updateChart(done, remaining) {
    const ctx = document.getElementById('taskChart').getContext('2d');

    if (taskChartInstance) {
        taskChartInstance.destroy();
    }

    // görev yoksa 
    let chartData = [done, remaining];
    let chartColors = ['#22c55e', '#ef4444'];
    let chartLabels = ['Completed', 'Remaining'];

    if (done === 0 && remaining === 0) {
        chartData = [1]; 
        chartColors = ['rgba(255, 255, 255, 0.1)']; 
        chartLabels = ['No Tasks'];
    }

    taskChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderColor: '#1e293b',
                borderWidth: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: 'white', padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.label === 'No Tasks') return ' No tasks have been added yet.';
                            return ' ' + context.label + ': ' + context.raw;
                        }
                    }
                }
            }
        }
    });
}

// localStorage
function saveSettings() {
    let inputName = document.getElementById("usernameInput").value.trim();
    
    if (inputName !== "") {
        // tarayıcıya isim kaydet
        localStorage.setItem("studyflow_username", inputName);
        
        // ekrondaki yazıyı anında güncelle
        document.getElementById("welcomeText").innerText = `Welcome Back, ${inputName} 👋`;
        alert("Settings saved successfully!");
    }
}

// hafızadaki ayarları geri getir
function loadSettings() {
    let savedName = localStorage.getItem("studyflow_username");
    
    if (savedName) {
        // hafızada bir isim varsa başlık ve input
        document.getElementById("welcomeText").innerText = `Welcome Back, ${savedName} 👋`;
        document.getElementById("usernameInput").value = savedName;
    }
}
