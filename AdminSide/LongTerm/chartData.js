export async function getChartData() {
    return {
        revenue: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Monthly Revenue',
                data: [30000, 35000, 32000, 38000, 40000, 42000],
                borderColor: '#1e3c72',
                tension: 0.4
            }]
        },
        occupancy: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Occupancy Rate',
                data: [75, 82, 78, 85, 88, 90],
                borderColor: '#2ecc71',
                tension: 0.4
            }]
        }
    };
}
