<template>
    <div>
        <input v-model="roomNumber" placeholder="Room Number">
        <select v-model="roomStatus">
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
        </select>
        <button @click="submitRoom">Add Room</button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            roomNumber: '',
            roomStatus: 'available',
        };
    },
    methods: {
        submitRoom() {
            const newRoom = {
                roomNumber: this.roomNumber,
                status: this.roomStatus,
                roomType: 'Standard'  // Add more fields as needed
            };
            this.$store.commit('setRooms', [...this.$store.state.rooms, newRoom]);  // Add room to Vuex store
        }
    }
};
</script>
