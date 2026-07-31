export type QueryRenderState = "error" | "loading" | "ready";

type QueryRenderStateInput = {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isPrerequisitePending?: boolean;
};

export function getQueryRenderState({
  data,
  isError,
  isFetching,
  isLoading,
  isPrerequisitePending = false,
}: QueryRenderStateInput): QueryRenderState {
  const hasData = data !== undefined;

  if (isPrerequisitePending || (!hasData && (isLoading || isFetching))) {
    return "loading";
  }

  if (!hasData && isError && !isFetching) {
    return "error";
  }

  return "ready";
}
