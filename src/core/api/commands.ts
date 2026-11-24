export interface Command<I, O> {
    readonly name: string;
}

export const defineCommand = <Input, Output>(
    name: string,
): Command<Input, Output> => {
    return {
        name,
    };
};
