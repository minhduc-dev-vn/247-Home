import { checkServiceArea, serviceAreaCheckSchema } from '@/modules/catalog';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    serviceAreaCheckSchema,
    { rateLimitScope: 'service-area-check' },
    async (requestId, input) => {
      return createSuccessResponse(
        await checkServiceArea(input.provinceCode, input.districtCode),
        requestId,
      );
    },
  );
}
