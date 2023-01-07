export type RequestConfigType = 'function' | 'storage';

export interface RequestConfig {
  type: RequestConfigType;
  prop: string;
  args: any[];
}

export function getRequestConfig(
  type: RequestConfigType,
  prop: PropertyKey,
  args: any[]
): RequestConfig {
  return {
    type,
    prop: String(prop),
    args: args,
  };
}
