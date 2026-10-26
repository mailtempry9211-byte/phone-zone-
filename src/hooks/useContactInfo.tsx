
import { useQuery } from "@tanstack/react-query";
import { data, type ContactInfo } from "@/lib/data";

export type { ContactInfo };

export const useContactInfo = () => {
  return useQuery({
    queryKey: ['contact-info'],
    queryFn: (): Promise<ContactInfo> => data.getContactInfo()
  });
};
