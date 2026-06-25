import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";

export const ClientPicker = ({ value, onChange }: any) => {
  const { profile } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (profile?.company_id) {
      api.from("clients").select("id, full_name, national_id").eq("company_id", profile.company_id)
        .then(({ data }) => setClients(data || []));
    }
  }, [profile]);

  const selectedClient = clients.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedClient ? `${selectedClient.full_name} (${selectedClient.national_id})` : "Select a client..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search client by name or ID..." />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`${client.full_name} ${client.national_id}`}
                  onSelect={() => {
                    onChange(client.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === client.id ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {client.full_name} ({client.national_id})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
