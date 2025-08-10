<template>
    <div>
        <h3>Dashboard</h3>
        <div>Available Rooms: {{ availableRooms }}</div>
        <div>Occupied Rooms: {{ occupiedRooms }}</div>
        <div>Total Revenue: {{ revenue }}</div>
        <div>Check-ins Today: {{ checkInsToday }}</div>
        <div>Recent Bookings:</div>
        <ul>
            <li v-for="booking in recentBookings" :key="booking.roomNumber">
                {{ booking.customerName }} ({{ booking.roomNumber }})
            </li>
        </ul>
    </div>
</template>

<script>
export default {
    computed: {
        availableRooms() {
            return this.$store.state.dashboardData.availableRooms;
        },
        occupiedRooms() {
            return this.$store.state.dashboardData.occupiedRooms;
        },
        revenue() {
            return this.$store.state.dashboardData.revenue;
        },
        checkInsToday() {
            return this.$store.state.dashboardData.checkInsToday;
        },
        recentBookings() {
            return this.$store.state.dashboardData.recentBookings;
        }
    },
    mounted() {
        // Fetch initial data
        this.$store.dispatch('fetchRooms');
        this.$store.dispatch('fetchReservations');
    }
};
</script>
