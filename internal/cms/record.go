package cms

type DrugRecord struct {
	PrscrbrGeoLvl  string `json:"Prscrbr_Geo_Lvl"`
	PrscrbrGeoCd   string `json:"Prscrbr_Geo_Cd"`
	PrscrbrGeoDesc string `json:"Prscrbr_Geo_Desc"`

	BrandName   string `json:"Brnd_Name"`
	GenericName string `json:"Gnrc_Name"`

	TotPrescribers   string  `json:"Tot_Prscrbrs"`
	TotClaims        string  `json:"Tot_Clms"`
	Tot30DayFills    float64 `json:"Tot_30day_Fills,string"`
	TotDrugCost      float64 `json:"Tot_Drug_Cst,string"`
	TotBeneficiaries string  `json:"Tot_Benes"`

	GE65SuppressionFlag  string `json:"GE65_Sprsn_Flag"`
	GE65TotClaims        string `json:"GE65_Tot_Clms"`
	GE65Tot30DayFills    string `json:"GE65_Tot_30day_Fills"`
	GE65TotDrugCost      string `json:"GE65_Tot_Drug_Cst"`
	GE65TotBeneficiaries string `json:"GE65_Tot_Benes"`

	LISBeneCostShare    float64 `json:"LIS_Bene_Cst_Shr,string"`
	NonLISBeneCostShare float64 `json:"NonLIS_Bene_Cst_Shr,string"`
}
