interface Hook {
    beforeProc?: (prevent: () => void) => void;
    afterProc?: () => void;
}
