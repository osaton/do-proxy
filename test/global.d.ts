declare global {
  function getMiniflareBindings(): Bindings;
  function getMiniflareDurableObjectStorage(id: DurableObjectId): Promise<DurableObjectStorage>;
}

interface Bindings {
  TEST_DO: DurableObjectNamespace;
}

export {};
