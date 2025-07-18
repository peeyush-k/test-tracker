document.addEventListener('DOMContentLoaded', async () => {

    await loadDashboardData();
    
    document.getElementById('apply-filters').addEventListener('click', loadDashboardData);
});

async function loadDashboardData() {
    try {
        // Get filter values
        const theme = document.getElementById('theme-filter').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        
        // Build query string
        const params = new URLSearchParams();
        if (theme) params.append('theme', theme);
        if (dateFrom) params.append('startDate', dateFrom);
        if (dateTo) params.append('endDate', dateTo);
        
        // Fetch tests data
        const testsResponse = await fetch(`/api/tests?${params.toString()}`);
        const tests = await testsResponse.json();
        
        // Fetch insights data
        const insightsResponse = await fetch(`/api/insights?${params.toString()}`);
        const insights = await insightsResponse.json();
        
        if (!testsResponse.ok || !insightsResponse.ok) {
            throw new Error('Failed to fetch data');
        }
        
        // Render all dashboard components
        renderSummaryCards(insights.summary, tests);
        renderAccuracyTrend(tests);
        renderScoreProgress(tests);
        renderAttemptRateTrend(tests);
        populateTestTable(tests);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Failed to load dashboard data. Please try again.');
    }
}

function renderSummaryCards(summary, tests) {
    // Handle empty/missing data
    if (!summary || !tests || tests.length === 0) {
        document.getElementById('avg-accuracy').textContent = '--%';
        document.getElementById('avg-net-score').textContent = '--';
        document.getElementById('avg-attempt-rate').textContent = '--%';
        document.getElementById('total-tests').textContent = '--';
        return;
    }

    // 1. Calculate NORMALIZED average net score (100Q equivalent)
    const avgNetScoreNormalized = tests.reduce((sum, test) => {
        const scaleFactor = 100 / test.totalQuestions;
        return sum + (test.netScore * scaleFactor);
    }, 0) / tests.length;

    // 2. Calculate ACCURACY from tests with attempts (better than backend average)
    const testsWithAttempts = tests.filter(t => 
        (t.confidentAttempts + t.guessedAttempts) > 0
    );
    
    const avgAccuracy = testsWithAttempts.length > 0
        ? testsWithAttempts.reduce((sum, t) => sum + (
            (t.totalCorrect) / (t.confidentAttempts + t.guessedAttempts) * 100
        ), 0) / testsWithAttempts.length
        : 0;

    // 3. Update UI
    document.getElementById('avg-accuracy').textContent = 
        `${avgAccuracy.toFixed(1)}%`; // Use our new calculation
    
    document.getElementById('avg-net-score').textContent = 
        avgNetScoreNormalized.toFixed(2);
    
    document.getElementById('avg-attempt-rate').textContent = 
        typeof summary.avgAttemptRate === 'number' 
            ? `${summary.avgAttemptRate.toFixed(1)}%` 
            : '--%';
    
    document.getElementById('total-tests').textContent = 
        summary.totalTests?.toString() || '--';
}

function renderAccuracyTrend(tests) {
    // Sort tests by date
    tests.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const ctx = document.getElementById('accuracy-trend').getContext('2d');
    
    // Destroy previous chart if exists
    if (window.accuracyChart) window.accuracyChart.destroy();
    
    window.accuracyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tests.map(t => new Date(t.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Confident Accuracy',
                    data: tests.map(t => t.confidentAccuracy),
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Guess Accuracy',
                    data: tests.map(t => t.guessAccuracy >= 0 ? t.guessAccuracy : null),
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    tension: 0.3,
                    spanGaps: true,
                    fill: true
                },
                {
                    label: 'Overall Accuracy',
                    data: tests.map(t => t.overallAccuracy),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Accuracy (%)'
                    }
                },
                x: {
                        display: false
                }
            }
        }
    });
}

function renderScoreProgress(tests) {
    tests.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const ctx = document.getElementById('score-progress').getContext('2d');
    if (window.scoreChart) window.scoreChart.destroy();
    
    window.scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tests.map(t => new Date(t.date).toLocaleDateString()),
            datasets: [{
                label: 'Normalized Score',
                data: tests.map(t => {
                    const scaleFactor = 100 / t.totalQuestions;
                    return Number((t.netScore * scaleFactor).toFixed(1));
                }),
                borderColor: '#9b59b6',
                backgroundColor: 'rgba(155, 89, 182, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 200,
                    title: {
                        display: true,
                        text: 'Score'
                    },
                    ticks: {
                        callback: function(value) {
                            return value;
                        }
                    }
                },
                x: {
                    display: false
                }
            },
            plugins: {
                annotation: {
                    annotations: {
    dangerZone: {
        type: 'box',
        yMin: 0,
        yMax: 120,
        backgroundColor: 'rgba(255, 0, 0, 0.1)', // Light red
        borderWidth: 0,
    },
    cutoffLine: {
        type: 'line',
        yMin: 120,
        yMax: 120,
        borderColor: '#ff5252',
        borderWidth: 2,
        label: {
            content: '120 Marks',
            position: 'right'
        }
    }
}
                  }
            }
        }
    });
}

function renderAttemptRateTrend(tests) {
    // Sort tests by date
    tests.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const ctx = document.getElementById('attempt-trend').getContext('2d');
    
    // Destroy previous chart if exists
    if (window.attemptChart) window.attemptChart.destroy();
    
    window.attemptChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: tests.map(t => new Date(t.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Attempt Rate',
                    data: tests.map(t => t.attemptRate),
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Attempt Rate (%)'
                    }
                },
                x: {
                        display: false
                }
            }
        }
    });
}

function populateTestTable(tests) {
    const tableBody = document.querySelector('#test-history tbody');
    tableBody.innerHTML = '';
    
    // Sort tests by date (newest first)
    tests.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tests.forEach(test => {
        const row = document.createElement('tr');
        const maxMarks = test.totalQuestions * 2;
        
        row.innerHTML = `
            <td>${new Date(test.date).toLocaleDateString()}</td>
            <td>${test.testName}</td>
            <td>${test.theme}</td>
            <td>${test.confidentAccuracy.toFixed(1)}%</td>
            <td>${test.guessAccuracy >= 0 ? test.guessAccuracy.toFixed(1) + '%' : '--'}</td>
            <td>${test.netScore.toFixed(2)}/${maxMarks}</td>
        `;
        
        tableBody.appendChild(row);
    });
}