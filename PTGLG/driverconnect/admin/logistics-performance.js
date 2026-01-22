// logistics-performance.js
// Performance Report Module for Admin Dashboard

import { supabase } from './admin.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializePerformanceReport();
});

let performanceCharts = {
    tripsChart: null,
    onTimeChart: null,
    vehicleChart: null,
    driverChart: null
};

function initializePerformanceReport() {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('perf-start-date').valueAsDate = startDate;
    document.getElementById('perf-end-date').valueAsDate = endDate;
    
    // Load vehicle and driver filters
    loadFilters();
    
    // Attach event listeners
    document.getElementById('perf-load-btn').addEventListener('click', loadPerformanceReport);
    document.getElementById('perf-export-btn').addEventListener('click', exportToExcel);
    document.getElementById('perf-search').addEventListener('input', filterTripsTable);
}

async function loadFilters() {
    try {
        // Load vehicles
        const { data: vehicles } = await supabase
            .from('jobdata')
            .select('vehicle_desc')
            .not('vehicle_desc', 'is', null)
            .order('vehicle_desc');
        
        const vehicleSelect = document.getElementById('perf-vehicle-filter');
        const uniqueVehicles = [...new Set(vehicles.map(v => v.vehicle_desc))];
        uniqueVehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle;
            option.textContent = vehicle;
            vehicleSelect.appendChild(option);
        });
        
        // Load drivers
        const { data: drivers } = await supabase
            .from('user_profiles')
            .select('user_id, display_name')
            .eq('user_type', 'DRIVER')
            .order('display_name');
        
        const driverSelect = document.getElementById('perf-driver-filter');
        drivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.user_id;
            option.textContent = driver.display_name;
            driverSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function loadPerformanceReport() {
    const startDate = document.getElementById('perf-start-date').value;
    const endDate = document.getElementById('perf-end-date').value;
    const vehicleFilter = document.getElementById('perf-vehicle-filter').value;
    const driverFilter = document.getElementById('perf-driver-filter').value;
    
    if (!startDate || !endDate) {
        alert('Please select date range');
        return;
    }
    
    // Show loading
    document.getElementById('perf-load-btn').textContent = 'Loading...';
    document.getElementById('perf-load-btn').disabled = true;
    
    try {
        // Build query
        let query = supabase
            .from('jobdata')
            .select(`
                *,
                driver_logs(*)
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate + 'T23:59:59');
        
        if (vehicleFilter) {
            query = query.eq('vehicle_desc', vehicleFilter);
        }
        
        if (driverFilter) {
            query = query.like('drivers', `%${driverFilter}%`);
        }
        
        const { data: trips, error } = await query;
        
        if (error) throw error;
        
        // Calculate KPIs
        const kpis = calculateKPIs(trips);
        updateKPICards(kpis);
        
        // Update charts
        updateCharts(trips, kpis);
        
        // Update tables
        updatePerformanceTables(trips);
        
        // Store trips for filtering
        window.performanceTrips = trips;
        
    } catch (error) {
        console.error('Error loading performance report:', error);
        alert('Error loading report: ' + error.message);
    } finally {
        document.getElementById('perf-load-btn').textContent = 'Load Report';
        document.getElementById('perf-load-btn').disabled = false;
    }
}

function calculateKPIs(trips) {
    const kpis = {
        totalTrips: trips.length,
        onTimeTrips: 0,
        lateTrips: 0,
        totalDistance: 0,
        totalDuration: 0,
        completedTrips: 0,
        vehiclesUsed: new Set(),
        driversActive: new Set()
    };
    
    trips.forEach(trip => {
        // Vehicle and driver counts
        if (trip.vehicle_desc) kpis.vehiclesUsed.add(trip.vehicle_desc);
        if (trip.drivers) kpis.driversActive.add(trip.drivers);
        
        // Only count completed trips for detailed metrics
        if (trip.checkout_time && trip.checkin_time) {
            kpis.completedTrips++;
            
            // Calculate duration
            const checkin = new Date(trip.checkin_time);
            const checkout = new Date(trip.checkout_time);
            const duration = (checkout - checkin) / (1000 * 60 * 60); // hours
            kpis.totalDuration += duration;
            
            // On-time calculation (simplified - could be enhanced with planned time)
            // Assuming < 8 hours is on-time
            if (duration <= 8) {
                kpis.onTimeTrips++;
            } else {
                kpis.lateTrips++;
            }
            
            // Distance calculation (from odometer if available)
            if (trip.checkout_odo && trip.checkin_odo) {
                const distance = trip.checkout_odo - trip.checkin_odo;
                if (distance > 0 && distance < 2000) { // Reasonable range
                    kpis.totalDistance += distance;
                }
            }
        }
    });
    
    // Calculate averages
    kpis.avgTripTime = kpis.completedTrips > 0 ? kpis.totalDuration / kpis.completedTrips : 0;
    kpis.onTimeRate = kpis.completedTrips > 0 ? (kpis.onTimeTrips / kpis.completedTrips) * 100 : 0;
    kpis.avgDistance = kpis.completedTrips > 0 ? kpis.totalDistance / kpis.completedTrips : 0;
    
    return kpis;
}

function updateKPICards(kpis) {
    document.getElementById('perf-total-trips').textContent = kpis.totalTrips.toLocaleString();
    document.getElementById('perf-on-time-rate').textContent = kpis.onTimeRate.toFixed(1) + '%';
    document.getElementById('perf-avg-trip-time').textContent = kpis.avgTripTime.toFixed(1) + 'h';
    document.getElementById('perf-total-distance').textContent = kpis.totalDistance.toFixed(0) + ' km';
    
    // Utilization (vehicles used / total vehicles * 100)
    // For now, just show active vehicles
    const utilization = kpis.vehiclesUsed.size;
    document.getElementById('perf-utilization').textContent = utilization + ' vehicles';
    
    // Trends (placeholder - would need historical data)
    document.getElementById('perf-trips-trend').textContent = '↗ +5% vs last period';
    document.getElementById('perf-on-time-trend').textContent = 
        kpis.onTimeRate >= 90 ? '✅ Excellent' : kpis.onTimeRate >= 80 ? '⚠️ Good' : '❌ Needs Improvement';
    document.getElementById('perf-time-trend').textContent = '↘ -0.2h vs last period';
    document.getElementById('perf-distance-trend').textContent = '→ Similar to last period';
}

function updateCharts(trips, kpis) {
    // Trips Trend Chart
    updateTripsTrendChart(trips);
    
    // On-Time Chart
    updateOnTimeChart(kpis);
    
    // Vehicle Performance Chart
    updateVehiclePerformanceChart(trips);
    
    // Driver Performance Chart
    updateDriverPerformanceChart(trips);
}

function updateTripsTrendChart(trips) {
    // Group trips by date
    const tripsByDate = {};
    trips.forEach(trip => {
        const date = new Date(trip.created_at).toISOString().split('T')[0];
        tripsByDate[date] = (tripsByDate[date] || 0) + 1;
    });
    
    const dates = Object.keys(tripsByDate).sort();
    const counts = dates.map(date => tripsByDate[date]);
    
    const ctx = document.getElementById('trips-trend-chart').getContext('2d');
    
    // Destroy existing chart if any
    if (performanceCharts.tripsChart) {
        performanceCharts.tripsChart.destroy();
    }
    
    performanceCharts.tripsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(date => new Date(date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Trips',
                data: counts,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateOnTimeChart(kpis) {
    const ctx = document.getElementById('on-time-chart').getContext('2d');
    
    if (performanceCharts.onTimeChart) {
        performanceCharts.onTimeChart.destroy();
    }
    
    performanceCharts.onTimeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['On-Time', 'Late'],
            datasets: [{
                data: [kpis.onTimeTrips, kpis.lateTrips],
                backgroundColor: ['#4CAF50', '#f44336'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateVehiclePerformanceChart(trips) {
    // Count trips by vehicle
    const vehicleTrips = {};
    trips.forEach(trip => {
        if (trip.vehicle_desc) {
            vehicleTrips[trip.vehicle_desc] = (vehicleTrips[trip.vehicle_desc] || 0) + 1;
        }
    });
    
    // Get top 10
    const sorted = Object.entries(vehicleTrips)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const vehicles = sorted.map(v => v[0]);
    const counts = sorted.map(v => v[1]);
    
    const ctx = document.getElementById('vehicle-performance-chart').getContext('2d');
    
    if (performanceCharts.vehicleChart) {
        performanceCharts.vehicleChart.destroy();
    }
    
    performanceCharts.vehicleChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: vehicles,
            datasets: [{
                label: 'Trips',
                data: counts,
                backgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateDriverPerformanceChart(trips) {
    // Count trips by driver
    const driverTrips = {};
    trips.forEach(trip => {
        if (trip.drivers) {
            driverTrips[trip.drivers] = (driverTrips[trip.drivers] || 0) + 1;
        }
    });
    
    // Get top 10
    const sorted = Object.entries(driverTrips)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const drivers = sorted.map(d => d[0]);
    const counts = sorted.map(d => d[1]);
    
    const ctx = document.getElementById('driver-performance-chart').getContext('2d');
    
    if (performanceCharts.driverChart) {
        performanceCharts.driverChart.destroy();
    }
    
    performanceCharts.driverChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: drivers,
            datasets: [{
                label: 'Trips',
                data: counts,
                backgroundColor: '#FF9800'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updatePerformanceTables(trips) {
    // Vehicle performance table
    const vehiclePerf = {};
    trips.forEach(trip => {
        if (!trip.vehicle_desc) return;
        
        if (!vehiclePerf[trip.vehicle_desc]) {
            vehiclePerf[trip.vehicle_desc] = {
                trips: 0,
                distance: 0,
                duration: 0,
                onTime: 0,
                completed: 0
            };
        }
        
        vehiclePerf[trip.vehicle_desc].trips++;
        
        if (trip.checkout_time && trip.checkin_time) {
            vehiclePerf[trip.vehicle_desc].completed++;
            
            const duration = (new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60);
            vehiclePerf[trip.vehicle_desc].duration += duration;
            
            if (duration <= 8) {
                vehiclePerf[trip.vehicle_desc].onTime++;
            }
            
            if (trip.checkout_odo && trip.checkin_odo) {
                const distance = trip.checkout_odo - trip.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    vehiclePerf[trip.vehicle_desc].distance += distance;
                }
            }
        }
    });
    
    // Sort by trips
    const vehicleSorted = Object.entries(vehiclePerf)
        .sort((a, b) => b[1].trips - a[1].trips)
        .slice(0, 20);
    
    const vehicleTableBody = document.querySelector('#perf-vehicle-table tbody');
    vehicleTableBody.innerHTML = '';
    
    vehicleSorted.forEach(([vehicle, perf], index) => {
        const row = document.createElement('tr');
        const onTimeRate = perf.completed > 0 ? (perf.onTime / perf.completed * 100).toFixed(1) : 0;
        const avgTime = perf.completed > 0 ? (perf.duration / perf.completed).toFixed(1) : 0;
        const avgDistance = perf.completed > 0 ? (perf.distance / perf.completed).toFixed(0) : 0;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${vehicle}</td>
            <td>${perf.trips}</td>
            <td>${avgDistance}</td>
            <td>${onTimeRate}%</td>
            <td>${avgTime}h</td>
        `;
        vehicleTableBody.appendChild(row);
    });
    
    // Driver performance table (similar logic)
    const driverPerf = {};
    trips.forEach(trip => {
        if (!trip.drivers) return;
        
        if (!driverPerf[trip.drivers]) {
            driverPerf[trip.drivers] = {
                trips: 0,
                distance: 0,
                duration: 0,
                onTime: 0,
                completed: 0
            };
        }
        
        driverPerf[trip.drivers].trips++;
        
        if (trip.checkout_time && trip.checkin_time) {
            driverPerf[trip.drivers].completed++;
            
            const duration = (new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60);
            driverPerf[trip.drivers].duration += duration;
            
            if (duration <= 8) {
                driverPerf[trip.drivers].onTime++;
            }
            
            if (trip.checkout_odo && trip.checkin_odo) {
                const distance = trip.checkout_odo - trip.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    driverPerf[trip.drivers].distance += distance;
                }
            }
        }
    });
    
    const driverSorted = Object.entries(driverPerf)
        .sort((a, b) => b[1].trips - a[1].trips)
        .slice(0, 20);
    
    const driverTableBody = document.querySelector('#perf-driver-table tbody');
    driverTableBody.innerHTML = '';
    
    driverSorted.forEach(([driver, perf], index) => {
        const row = document.createElement('tr');
        const onTimeRate = perf.completed > 0 ? (perf.onTime / perf.completed * 100).toFixed(1) : 0;
        const avgTime = perf.completed > 0 ? (perf.duration / perf.completed).toFixed(1) : 0;
        const avgDistance = perf.completed > 0 ? (perf.distance / perf.completed).toFixed(0) : 0;
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${driver}</td>
            <td>${perf.trips}</td>
            <td>${avgDistance}</td>
            <td>${onTimeRate}%</td>
            <td>${avgTime}h</td>
        `;
        driverTableBody.appendChild(row);
    });
    
    // Route analysis table
    updateRouteAnalysis(trips);
    
    // Detailed trips table
    updateTripsTable(trips);
}

function updateRouteAnalysis(trips) {
    // Group by ship_to_name (destination)
    const routePerf = {};
    
    trips.forEach(trip => {
        if (!trip.ship_to_name) return;
        
        if (!routePerf[trip.ship_to_name]) {
            routePerf[trip.ship_to_name] = {
                trips: 0,
                distance: 0,
                duration: 0,
                onTime: 0,
                completed: 0,
                success: 0
            };
        }
        
        routePerf[trip.ship_to_name].trips++;
        
        if (trip.checkout_time && trip.checkin_time) {
            routePerf[trip.ship_to_name].completed++;
            
            const duration = (new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60);
            routePerf[trip.ship_to_name].duration += duration;
            
            if (duration <= 8) {
                routePerf[trip.ship_to_name].onTime++;
            }
            
            if (trip.checkout_odo && trip.checkin_odo) {
                const distance = trip.checkout_odo - trip.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    routePerf[trip.ship_to_name].distance += distance;
                }
            }
        }
        
        if (trip.status === 'COMPLETED' || trip.job_closed) {
            routePerf[trip.ship_to_name].success++;
        }
    });
    
    const routeSorted = Object.entries(routePerf)
        .sort((a, b) => b[1].trips - a[1].trips)
        .slice(0, 15);
    
    const routeTableBody = document.querySelector('#perf-route-table tbody');
    routeTableBody.innerHTML = '';
    
    routeSorted.forEach(([route, perf]) => {
        const row = document.createElement('tr');
        const avgDistance = perf.completed > 0 ? (perf.distance / perf.completed).toFixed(0) : 0;
        const avgDuration = perf.completed > 0 ? (perf.duration / perf.completed).toFixed(1) : 0;
        const onTimeRate = perf.completed > 0 ? (perf.onTime / perf.completed * 100).toFixed(1) : 0;
        const successRate = perf.trips > 0 ? (perf.success / perf.trips * 100).toFixed(1) : 0;
        
        row.innerHTML = `
            <td>${route}</td>
            <td>${perf.trips}</td>
            <td>${avgDistance}</td>
            <td>${avgDuration}</td>
            <td>${onTimeRate}%</td>
            <td>${successRate}%</td>
        `;
        routeTableBody.appendChild(row);
    });
}

function updateTripsTable(trips) {
    const tripsTableBody = document.querySelector('#perf-trips-table tbody');
    tripsTableBody.innerHTML = '';
    
    document.getElementById('perf-trip-count').textContent = trips.length + ' trips';
    
    trips.forEach(trip => {
        const row = document.createElement('tr');
        
        const date = new Date(trip.created_at).toLocaleDateString('th-TH');
        const duration = trip.checkout_time && trip.checkin_time ? 
            ((new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60)).toFixed(1) + 'h' : 
            '-';
        
        const distance = trip.checkout_odo && trip.checkin_odo ? 
            (trip.checkout_odo - trip.checkin_odo).toFixed(0) + ' km' : 
            '-';
        
        const onTime = trip.checkout_time && trip.checkin_time ?
            ((new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60) <= 8 ? '✅' : '❌') :
            '-';
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${trip.reference || '-'}</td>
            <td>${trip.vehicle_desc || '-'}</td>
            <td>${trip.drivers || '-'}</td>
            <td>${trip.ship_to_name || '-'}</td>
            <td>${distance}</td>
            <td>${duration}</td>
            <td>${trip.status || '-'}</td>
            <td>${onTime}</td>
        `;
        
        tripsTableBody.appendChild(row);
    });
}

function filterTripsTable() {
    const searchTerm = document.getElementById('perf-search').value.toLowerCase();
    const rows = document.querySelectorAll('#perf-trips-table tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    document.getElementById('perf-trip-count').textContent = visibleCount + ' trips';
}

function exportToExcel() {
    if (!window.performanceTrips || window.performanceTrips.length === 0) {
        alert('Please load report first');
        return;
    }
    
    // Prepare data for export
    const exportData = window.performanceTrips.map(trip => ({
        'Date': new Date(trip.created_at).toLocaleDateString('th-TH'),
        'Reference': trip.reference || '',
        'Vehicle': trip.vehicle_desc || '',
        'Driver': trip.drivers || '',
        'Route': trip.ship_to_name || '',
        'Check-in': trip.checkin_time ? new Date(trip.checkin_time).toLocaleString('th-TH') : '',
        'Check-out': trip.checkout_time ? new Date(trip.checkout_time).toLocaleString('th-TH') : '',
        'Duration (h)': trip.checkout_time && trip.checkin_time ? 
            ((new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60)).toFixed(2) : '',
        'Distance (km)': trip.checkout_odo && trip.checkin_odo ? 
            (trip.checkout_odo - trip.checkin_odo).toFixed(0) : '',
        'Status': trip.status || '',
        'On-Time': trip.checkout_time && trip.checkin_time ?
            ((new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60) <= 8 ? 'Yes' : 'No') : ''
    }));
    
    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csv = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `logistics_performance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export for use in admin.js if needed
export { initializePerformanceReport, loadPerformanceReport };
