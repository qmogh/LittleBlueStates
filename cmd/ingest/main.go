package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/qmogh/LittleBlueStates/internal/cms"
)

func main() {
	url := "https://data.cms.gov/data-api/v1/dataset/9b4c142c-69cc-4a96-a09a-7cf2ba7f5816/data?filter[Gnrc_Name]=Sildenafil%20Citrate"

	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("ERROR:  %v\n", err)
		return
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	var records []cms.DrugRecord
	jsonErr := json.Unmarshal(body, &records)
	if jsonErr != nil {
		log.Fatal(jsonErr)
	}

	sum := 0
	for _, record := range records {
		if record.PrscrbrGeoDesc == "Connecticut" {
			num, err := strconv.Atoi(record.TotClaims)
			if err != nil {
				log.Fatal(err)
			}
			sum += num
		}
	}

	fmt.Println("Total Viagara Claims Connecticut: ", sum)
}
