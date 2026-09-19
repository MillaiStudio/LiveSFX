<script setup lang="ts">
import { useLog } from '@/core/store/logstore';

const { log_stack } = useLog();
</script>
<template>
    <div>
        <h2>ログ</h2>
        <section>
            <p v-for="value in log_stack">
                {{ value }}
            </p>
        </section>
    </div>
</template>
<style scoped></style>
