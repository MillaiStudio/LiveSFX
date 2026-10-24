export interface Command<I, O> {
    readonly name: string;
    readonly types?: { input: I; output: O };
}

export const defineCommand = <Input, Output>(
    name: string,
): Command<Input, Output> => {
    return {
        name,
    };
};
