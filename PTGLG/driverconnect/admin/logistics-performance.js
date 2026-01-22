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
        // Build query - select all fields from jobdata
        let query = supabase
            .from('jobdata')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate + 'T23:59:59')
            .order('reference', { ascending: true })
            .order('seq', { ascending: true });
        
        if (vehicleFilter) {
            query = query.eq('vehicle_desc', vehicleFilter);
        }

        if (driverFilter) {
            query = query.ilike('drivers', `%${driverFilter}%`);
        }

        const { data: trips, error } = await query;

        console.log(`📊 Loaded ${trips?.length || 0} records from jobdata for performance report`);
        
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
    // Group trips by reference to count unique trips (not individual stops)
    const tripsByReference = {};
    trips.forEach(trip => {
        if (!tripsByReference[trip.reference]) {
            tripsByReference[trip.reference] = [];
        }
        tripsByReference[trip.reference].push(trip);
    });

    const uniqueReferences = Object.keys(tripsByReference);

    const kpis = {
        totalTrips: uniqueReferences.length,
        totalStops: trips.length,
        onTimeTrips: 0,
        lateTrips: 0,
        totalDistance: 0,
        totalDuration: 0,
        completedTrips: 0,
        completedStops: 0,
        vehiclesUsed: new Set(),
        driversActive: new Set(),
        holidayWorkCount: 0,
        totalQuantity: 0
    };

    // Process each reference (trip)
    uniqueReferences.forEach(reference => {
        const stops = tripsByReference[reference];
        const firstStop = stops[0];

        // Vehicle and driver counts
        if (firstStop.vehicle_desc) kpis.vehiclesUsed.add(firstStop.vehicle_desc);
        if (firstStop.drivers) {
            // Handle comma-separated drivers
            firstStop.drivers.split(',').forEach(d => {
                if (d.trim()) kpis.driversActive.add(d.trim());
            });
        }

        // Check if trip has holiday work
        if (stops.some(s => s.is_holiday_work)) {
            kpis.holidayWorkCount++;
        }

        // Sum total quantity
        stops.forEach(stop => {
            if (stop.total_qty) {
                kpis.totalQuantity += parseFloat(stop.total_qty) || 0;
            }
        });

        // Calculate trip stats - find first checkin and last checkout
        const checkins = stops.filter(s => s.checkin_time).map(s => new Date(s.checkin_time));
        const checkouts = stops.filter(s => s.checkout_time).map(s => new Date(s.checkout_time));

        if (checkins.length > 0 && checkouts.length > 0) {
            const firstCheckin = new Date(Math.min(...checkins));
            const lastCheckout = new Date(Math.max(...checkouts));
            const duration = (lastCheckout - firstCheckin) / (1000 * 60 * 60); // hours

            if (duration > 0) {
                kpis.completedTrips++;
                kpis.totalDuration += duration;

                // On-time calculation (< 12 hours considered on-time for full trip)
                if (duration <= 12) {
                    kpis.onTimeTrips++;
                } else {
                    kpis.lateTrips++;
                }
            }
        }

        // Distance calculation - prefer distance_km field, fallback to odometer
        stops.forEach(stop => {
            if (stop.distance_km && parseFloat(stop.distance_km) > 0) {
                kpis.totalDistance += parseFloat(stop.distance_km);
            } else if (stop.checkout_odo && stop.checkin_odo) {
                const distance = stop.checkout_odo - stop.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    kpis.totalDistance += distance;
                }
            }
        });

        // Count completed stops
        kpis.completedStops += stops.filter(s => s.checkout_time).length;
    });

    // Calculate averages
    kpis.avgTripTime = kpis.completedTrips > 0 ? kpis.totalDuration / kpis.completedTrips : 0;
    kpis.onTimeRate = kpis.completedTrips > 0 ? (kpis.onTimeTrips / kpis.completedTrips) * 100 : 0;
    kpis.avgDistance = kpis.completedTrips > 0 ? kpis.totalDistance / kpis.completedTrips : 0;
    kpis.stopCompletionRate = kpis.totalStops > 0 ? (kpis.completedStops / kpis.totalStops) * 100 : 0;

    return kpis;
}

function updateKPICards(kpis) {
    document.getElementById('perf-total-trips').textContent = kpis.totalTrips.toLocaleString();
    document.getElementById('perf-on-time-rate').textContent = kpis.onTimeRate.toFixed(1) + '%';
    document.getElementById('perf-avg-trip-time').textContent = kpis.avgTripTime.toFixed(1) + 'h';
    document.getElementById('perf-total-distance').textContent = kpis.totalDistance.toFixed(0).toLocaleString() + ' km';

    // Fuel efficiency (placeholder - would need fuel data)
    document.getElementById('perf-fuel-efficiency').textContent = '-';

    // Utilization - show active vehicles count
    const utilization = kpis.vehiclesUsed.size;
    document.getElementById('perf-utilization').textContent = utilization + ' vehicles';

    // Trend indicators with actual data context
    document.getElementById('perf-trips-trend').textContent =
        `${kpis.totalStops} stops | ${kpis.completedStops} completed`;
    document.getElementById('perf-on-time-trend').textContent =
        kpis.onTimeRate >= 90 ? '✅ Excellent' : kpis.onTimeRate >= 80 ? '⚠️ Good' : kpis.onTimeRate > 0 ? '❌ Needs Improvement' : '-';
    document.getElementById('perf-time-trend').textContent =
        `${kpis.completedTrips} trips completed`;
    document.getElementById('perf-distance-trend').textContent =
        kpis.avgDistance > 0 ? `Avg: ${kpis.avgDistance.toFixed(0)} km/trip` : '-';
    document.getElementById('perf-fuel-trend').textContent =
        kpis.totalQuantity > 0 ? `${(kpis.totalQuantity / 1000).toFixed(1)}k liters` : '-';
    document.getElementById('perf-util-trend').textContent =
        `${kpis.driversActive.size} drivers active`;
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
    // Group by reference first to count unique trips per vehicle
    const tripsByReference = {};
    trips.forEach(trip => {
        if (!tripsByReference[trip.reference]) {
            tripsByReference[trip.reference] = [];
        }
        tripsByReference[trip.reference].push(trip);
    });

    // Vehicle performance table
    const vehiclePerf = {};
    Object.entries(tripsByReference).forEach(([reference, stops]) => {
        const firstStop = stops[0];
        if (!firstStop.vehicle_desc) return;

        const vehicle = firstStop.vehicle_desc;
        if (!vehiclePerf[vehicle]) {
            vehiclePerf[vehicle] = {
                trips: 0,
                stops: 0,
                distance: 0,
                duration: 0,
                onTime: 0,
                completed: 0,
                totalQty: 0
            };
        }

        vehiclePerf[vehicle].trips++;
        vehiclePerf[vehicle].stops += stops.length;

        // Sum quantity for this trip
        stops.forEach(stop => {
            if (stop.total_qty) {
                vehiclePerf[vehicle].totalQty += parseFloat(stop.total_qty) || 0;
            }
        });

        // Calculate trip duration
        const checkins = stops.filter(s => s.checkin_time).map(s => new Date(s.checkin_time));
        const checkouts = stops.filter(s => s.checkout_time).map(s => new Date(s.checkout_time));

        if (checkins.length > 0 && checkouts.length > 0) {
            const duration = (Math.max(...checkouts) - Math.min(...checkins)) / (1000 * 60 * 60);
            if (duration > 0) {
                vehiclePerf[vehicle].completed++;
                vehiclePerf[vehicle].duration += duration;
                if (duration <= 12) {
                    vehiclePerf[vehicle].onTime++;
                }
            }
        }

        // Calculate distance
        stops.forEach(stop => {
            if (stop.distance_km && parseFloat(stop.distance_km) > 0) {
                vehiclePerf[vehicle].distance += parseFloat(stop.distance_km);
            } else if (stop.checkout_odo && stop.checkin_odo) {
                const distance = stop.checkout_odo - stop.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    vehiclePerf[vehicle].distance += distance;
                }
            }
        });
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
    
    // Driver performance table (process by reference)
    const driverPerf = {};
    Object.entries(tripsByReference).forEach(([reference, stops]) => {
        const firstStop = stops[0];
        if (!firstStop.drivers) return;

        // Handle comma-separated drivers
        const driverNames = firstStop.drivers.split(',').map(d => d.trim()).filter(d => d);

        driverNames.forEach(driver => {
            if (!driverPerf[driver]) {
                driverPerf[driver] = {
                    trips: 0,
                    stops: 0,
                    distance: 0,
                    duration: 0,
                    onTime: 0,
                    completed: 0,
                    totalQty: 0
                };
            }

            driverPerf[driver].trips++;
            driverPerf[driver].stops += stops.length;

            // Sum quantity for this trip
            stops.forEach(stop => {
                if (stop.total_qty) {
                    driverPerf[driver].totalQty += parseFloat(stop.total_qty) || 0;
                }
            });

            // Calculate trip duration
            const checkins = stops.filter(s => s.checkin_time).map(s => new Date(s.checkin_time));
            const checkouts = stops.filter(s => s.checkout_time).map(s => new Date(s.checkout_time));

            if (checkins.length > 0 && checkouts.length > 0) {
                const duration = (Math.max(...checkouts) - Math.min(...checkins)) / (1000 * 60 * 60);
                if (duration > 0) {
                    driverPerf[driver].completed++;
                    driverPerf[driver].duration += duration;
                    if (duration <= 12) {
                        driverPerf[driver].onTime++;
                    }
                }
            }

            // Calculate distance
            stops.forEach(stop => {
                if (stop.distance_km && parseFloat(stop.distance_km) > 0) {
                    driverPerf[driver].distance += parseFloat(stop.distance_km);
                } else if (stop.checkout_odo && stop.checkin_odo) {
                    const distance = stop.checkout_odo - stop.checkin_odo;
                    if (distance > 0 && distance < 2000) {
                        driverPerf[driver].distance += distance;
                    }
                }
            });
        });
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
    // Group by ship_to_name (destination/station)
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
                success: 0,
                totalQty: 0
            };
        }

        routePerf[trip.ship_to_name].trips++;

        // Sum quantity
        if (trip.total_qty) {
            routePerf[trip.ship_to_name].totalQty += parseFloat(trip.total_qty) || 0;
        }

        if (trip.checkout_time && trip.checkin_time) {
            routePerf[trip.ship_to_name].completed++;

            const duration = (new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60);
            routePerf[trip.ship_to_name].duration += duration;

            if (duration <= 4) { // 4 hours per stop is on-time
                routePerf[trip.ship_to_name].onTime++;
            }

            // Use distance_km if available
            if (trip.distance_km && parseFloat(trip.distance_km) > 0) {
                routePerf[trip.ship_to_name].distance += parseFloat(trip.distance_km);
            } else if (trip.checkout_odo && trip.checkin_odo) {
                const distance = trip.checkout_odo - trip.checkin_odo;
                if (distance > 0 && distance < 2000) {
                    routePerf[trip.ship_to_name].distance += distance;
                }
            }
        }

        if (trip.status === 'COMPLETED' || trip.status === 'CHECKED_OUT' || trip.job_closed) {
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

    // Group by reference for summary view
    const tripsByReference = {};
    trips.forEach(trip => {
        if (!tripsByReference[trip.reference]) {
            tripsByReference[trip.reference] = [];
        }
        tripsByReference[trip.reference].push(trip);
    });

    const uniqueTrips = Object.entries(tripsByReference);
    document.getElementById('perf-trip-count').textContent = `${uniqueTrips.length} trips (${trips.length} stops)`;

    // Show trip summaries
    uniqueTrips.forEach(([reference, stops]) => {
        const row = document.createElement('tr');
        const firstStop = stops[0];

        const date = new Date(firstStop.created_at).toLocaleDateString('th-TH');

        // Calculate trip duration from first checkin to last checkout
        const checkins = stops.filter(s => s.checkin_time).map(s => new Date(s.checkin_time));
        const checkouts = stops.filter(s => s.checkout_time).map(s => new Date(s.checkout_time));
        let duration = '-';
        let onTime = '-';
        if (checkins.length > 0 && checkouts.length > 0) {
            const durationHours = (Math.max(...checkouts) - Math.min(...checkins)) / (1000 * 60 * 60);
            duration = durationHours.toFixed(1) + 'h';
            onTime = durationHours <= 12 ? '✅' : '❌';
        }

        // Calculate total distance
        let totalDistance = 0;
        stops.forEach(stop => {
            if (stop.distance_km && parseFloat(stop.distance_km) > 0) {
                totalDistance += parseFloat(stop.distance_km);
            } else if (stop.checkout_odo && stop.checkin_odo) {
                const d = stop.checkout_odo - stop.checkin_odo;
                if (d > 0 && d < 2000) totalDistance += d;
            }
        });
        const distance = totalDistance > 0 ? totalDistance.toFixed(0) + ' km' : '-';

        // Get route summary
        const destinations = stops.map(s => s.ship_to_name).filter(Boolean);
        const routeSummary = destinations.length > 2
            ? `${destinations[0]} → ... → ${destinations[destinations.length - 1]}`
            : destinations.join(' → ') || '-';

        // Status summary
        const completedStops = stops.filter(s => s.checkout_time).length;
        const statusSummary = `${completedStops}/${stops.length} stops`;

        row.innerHTML = `
            <td>${date}</td>
            <td>${reference || '-'}</td>
            <td>${firstStop.vehicle_desc || '-'}</td>
            <td>${firstStop.drivers || '-'}</td>
            <td title="${destinations.join(' → ')}">${routeSummary}</td>
            <td>${distance}</td>
            <td>${duration}</td>
            <td>${statusSummary}</td>
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

    // Prepare detailed export data (all stops)
    const exportData = window.performanceTrips.map(trip => {
        // Calculate distance
        let distance = '';
        if (trip.distance_km && parseFloat(trip.distance_km) > 0) {
            distance = parseFloat(trip.distance_km).toFixed(2);
        } else if (trip.checkout_odo && trip.checkin_odo) {
            const d = trip.checkout_odo - trip.checkin_odo;
            if (d > 0 && d < 2000) distance = d.toFixed(0);
        }

        return {
            'Date': new Date(trip.created_at).toLocaleDateString('th-TH'),
            'Reference': trip.reference || '',
            'Seq': trip.seq || 1,
            'Vehicle': trip.vehicle_desc || '',
            'Driver': trip.drivers || '',
            'Ship To Code': trip.ship_to_code || '',
            'Ship To Name': trip.ship_to_name || '',
            'Quantity': trip.total_qty || '',
            'Materials': trip.materials || '',
            'Check-in': trip.checkin_time ? new Date(trip.checkin_time).toLocaleString('th-TH') : '',
            'Check-out': trip.checkout_time ? new Date(trip.checkout_time).toLocaleString('th-TH') : '',
            'Duration (h)': trip.checkout_time && trip.checkin_time ?
                ((new Date(trip.checkout_time) - new Date(trip.checkin_time)) / (1000 * 60 * 60)).toFixed(2) : '',
            'Distance (km)': distance,
            'Status': trip.status || '',
            'Job Closed': trip.job_closed ? 'Yes' : 'No',
            'Trip Ended': trip.trip_ended ? 'Yes' : 'No',
            'Holiday Work': trip.is_holiday_work ? 'Yes' : 'No'
        };
    });

    if (exportData.length === 0) {
        alert('No data to export');
        return;
    }

    // Convert to CSV
    const headers = Object.keys(exportData[0]);
    const csv = [
        headers.join(','),
        ...exportData.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
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
