<template>
    <div>
        <input v-model="customerName" placeholder="Customer Name">
        <input v-model="roomNumber" placeholder="Room Number">
        <input v-model="checkInDate" type="date">
        <input v-model="checkOutDate" type="date">
        <input v-model="amount" placeholder="Amount">
        <button @click="submitReservation">Add Reservation</button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            customerName: '',
            roomNumber: '',
            checkInDate: '',
            checkOutDate: '',
            amount: 0,
        };
    },
    methods: {
        submitReservation() {
            const newReservation = {
                customerName: this.customerName,
                roomNumber: this.roomNumber,
                checkInDate: this.checkInDate,
                checkOutDate: this.checkOutDate,
                amount: this.amount,
            };
            this.$store.commit('setReservations', [...this.$store.state.reservations, newReservation]);  // Add reservation to Vuex store
        }
    }
};
</script>
